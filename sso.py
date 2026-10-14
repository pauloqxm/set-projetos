"""Integração com o SET SSO (OpenID Connect: Authorization Code + PKCE)."""

from __future__ import annotations

import base64
import hashlib
import os
import secrets
import time
from urllib.parse import urlencode

import httpx
import jwt  # pyjwt[crypto]

SSO_URL = os.environ.get("SSO_URL", "https://sso.idt.org.br").rstrip("/")
CLIENT_ID = os.environ.get("SSO_CLIENT_ID", "set_projetos")
CLIENT_SECRET = os.environ.get("SSO_CLIENT_SECRET", "")
REDIRECT_URI = os.environ.get("SSO_REDIRECT_URI", "")
ISSUER = SSO_URL + "/"
COOKIE_FLUXO = "ct_sso_fluxo"

_jwks = jwt.PyJWKClient(f"{SSO_URL}/.well-known/jwks", cache_keys=True)
_token_app: dict = {"valor": None, "expira": 0.0}


def ativo() -> bool:
    return bool(CLIENT_SECRET and REDIRECT_URI)


def login_local_habilitado() -> bool:
    return os.environ.get("SSO_LOGIN_LOCAL", "1") == "1"


def _b64url(dados: bytes) -> str:
    return base64.urlsafe_b64encode(dados).rstrip(b"=").decode()


def iniciar_login() -> tuple[str, str]:
    """Devolve (url para redirecionar, valor do cookie do fluxo)."""
    state = secrets.token_urlsafe(24)
    nonce = secrets.token_urlsafe(24)
    verifier = secrets.token_urlsafe(48)
    challenge = _b64url(hashlib.sha256(verifier.encode()).digest())
    url = f"{SSO_URL}/connect/authorize?" + urlencode(
        {
            "client_id": CLIENT_ID,
            "response_type": "code",
            "scope": "openid profile email",
            "redirect_uri": REDIRECT_URI,
            "state": state,
            "nonce": nonce,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
    )
    return url, f"{state}.{nonce}.{verifier}"


def concluir_login(query: dict[str, str], cookie_fluxo: str | None) -> dict:
    """Valida o retorno do SSO. Devolve {"sub", "email", "nome"} ou levanta ErroSso."""
    if query.get("error"):
        raise ErroSso(query.get("error", ""), query.get("error_description", ""))
    try:
        state, nonce, verifier = (cookie_fluxo or "").split(".")
    except ValueError:
        raise ErroSso("fluxo_expirado", "Login expirou. Tente de novo.")
    if not secrets.compare_digest(query.get("state", ""), state):
        raise ErroSso("state_invalido", "Login inválido. Tente de novo.")

    resp = httpx.post(
        f"{SSO_URL}/connect/token",
        auth=(CLIENT_ID, CLIENT_SECRET),
        data={
            "grant_type": "authorization_code",
            "code": query.get("code", ""),
            "redirect_uri": REDIRECT_URI,
            "code_verifier": verifier,
        },
        timeout=15,
    )
    if resp.status_code != 200:
        raise ErroSso("token", resp.text[:300])

    id_token = resp.json()["id_token"]
    chave = _jwks.get_signing_key_from_jwt(id_token).key
    claims = jwt.decode(
        id_token, chave, algorithms=["RS256"], audience=CLIENT_ID, issuer=ISSUER
    )
    if not secrets.compare_digest(claims.get("nonce", ""), nonce):
        raise ErroSso("nonce_invalido", "Login inválido. Tente de novo.")
    return {
        "sub": claims["sub"],
        "email": claims.get("email", ""),
        "nome": claims.get("name", ""),
    }


def url_logout(id_token_hint: str | None = None) -> str:
    params = {
        "client_id": CLIENT_ID,
        "post_logout_redirect_uri": REDIRECT_URI.rsplit("/", 1)[0] + "/",
    }
    if id_token_hint:
        params["id_token_hint"] = id_token_hint
    return f"{SSO_URL}/connect/logout?" + urlencode(params)


def _token_aplicacao() -> str:
    if _token_app["valor"] and time.time() < _token_app["expira"] - 60:
        return _token_app["valor"]
    resp = httpx.post(
        f"{SSO_URL}/connect/token",
        auth=(CLIENT_ID, CLIENT_SECRET),
        data={"grant_type": "client_credentials", "scope": "sso_inscricoes"},
        timeout=15,
    )
    resp.raise_for_status()
    dados = resp.json()
    _token_app.update(
        valor=dados["access_token"],
        expira=time.time() + dados.get("expires_in", 900),
    )
    return _token_app["valor"]


def _api(metodo: str, caminho: str, **kwargs) -> httpx.Response:
    return httpx.request(
        metodo,
        f"{SSO_URL}/api/inscricoes{caminho}",
        headers={"Authorization": f"Bearer {_token_aplicacao()}"},
        timeout=20,
        **kwargs,
    )


def inscrever(email: str, nome: str) -> dict:
    """Convida (ou só libera, se já tiver conta) e devolve a inscrição, com "sub"."""
    resp = _api("POST", "", json={"email": email, "nome": nome})
    if resp.status_code not in (200, 201):
        raise ErroSso("inscricao", resp.text[:300])
    return resp.json()


def remover(sub: str) -> None:
    """Tira o acesso ao SET Projetos (não afeta outras aplicações)."""
    resp = _api("DELETE", f"/{sub}")
    if resp.status_code not in (204, 404):
        raise ErroSso("remocao", resp.text[:300])


def reenviar_convite(sub: str) -> None:
    _api("POST", f"/{sub}/reenviar-convite")


def situacao(sub: str) -> dict | None:
    resp = _api("GET", f"/{sub}")
    return resp.json() if resp.status_code == 200 else None


class ErroSso(Exception):
    def __init__(self, codigo: str, detalhe: str = ""):
        super().__init__(f"{codigo}: {detalhe}")
        self.codigo = codigo
        self.detalhe = detalhe
