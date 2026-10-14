(() => {
  const form = document.getElementById("loginForm");
  const usuario = document.getElementById("loginUsuario");
  const senha = document.getElementById("loginSenha");
  const error = document.getElementById("loginError");
  const submit = document.getElementById("loginSubmit");
  const toggle = document.getElementById("toggleSenha");
  const ssoBtn = document.getElementById("loginSso");
  const sep = document.getElementById("loginSep");

  const ERROS_SSO = {
    sem_acesso:
      "Sua conta não tem acesso ao SET Projetos. Fale com o administrador.",
    sso: "Não foi possível concluir o login. Tente de novo.",
  };

  const params = new URLSearchParams(location.search);
  const codigoErro = params.get("erro");
  if (codigoErro && ERROS_SSO[codigoErro]) {
    error.textContent = ERROS_SSO[codigoErro];
    error.hidden = false;
  }

  async function ensureLoggedOut() {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.usuario) {
        location.replace(
          data.usuario.papel === "reservas" ? "/salas.html" : "/portfolio.html"
        );
        return;
      }
      if (data.sso_ativo && ssoBtn) {
        ssoBtn.hidden = false;
        if (data.login_local) {
          if (sep) sep.hidden = false;
          submit.classList.add("btn-login-local");
          submit.textContent = "Entrar com usuário e senha";
        } else {
          form.hidden = true;
          usuario.required = false;
          senha.required = false;
        }
      }
    } catch (_) {}
  }

  toggle.addEventListener("click", () => {
    const show = senha.type === "password";
    senha.type = show ? "text" : "password";
    toggle.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
    toggle.title = show ? "Ocultar senha" : "Mostrar senha";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.hidden = true;
    submit.disabled = true;
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario: usuario.value.trim(),
          senha: senha.value,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        error.textContent = data.erro || "Não foi possível entrar.";
        error.hidden = false;
        return;
      }
      location.replace(
        data.usuario && data.usuario.papel === "reservas"
          ? "/salas.html"
          : "/portfolio.html"
      );
    } catch (_) {
      error.textContent = "Falha de conexão com o servidor.";
      error.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });

  ensureLoggedOut();
})();
