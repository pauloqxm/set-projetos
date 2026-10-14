(() => {
  const el = {
    form: document.getElementById("userForm"),
    userLogin: document.getElementById("userLogin"),
    userEmail: document.getElementById("userEmail"),
    userNome: document.getElementById("userNome"),
    userSenha: document.getElementById("userSenha"),
    userPapel: document.getElementById("userPapel"),
    userLoginWrap: document.getElementById("userLoginWrap"),
    userEmailWrap: document.getElementById("userEmailWrap"),
    userSenhaWrap: document.getElementById("userSenhaWrap"),
    userFormHint: document.getElementById("userFormHint"),
    usersListHint: document.getElementById("usersListHint"),
    formError: document.getElementById("formError"),
    usersBody: document.getElementById("usersBody"),
    userCount: document.getElementById("userCount"),
    btnSair: document.getElementById("btnSair"),
    btnVoltar: document.getElementById("btnVoltar"),
    dialog: document.getElementById("editUserDialog"),
    editForm: document.getElementById("editUserForm"),
    editId: document.getElementById("editUserId"),
    editTitle: document.getElementById("editUserTitle"),
    editNome: document.getElementById("editUserNome"),
    editEmail: document.getElementById("editUserEmail"),
    editPapel: document.getElementById("editUserPapel"),
    editAtivo: document.getElementById("editUserAtivo"),
    editSenha: document.getElementById("editUserSenha"),
    editSenhaWrap: document.getElementById("editSenhaWrap"),
    ligarSsoBox: document.getElementById("ligarSsoBox"),
    ligarSsoEmail: document.getElementById("ligarSsoEmail"),
    btnLigarSso: document.getElementById("btnLigarSso"),
    btnReenviarConvite: document.getElementById("btnReenviarConvite"),
    editError: document.getElementById("editUserError"),
    editCancel: document.getElementById("editUserCancel"),
    editDelete: document.getElementById("editUserDelete"),
  };

  let usuarios = [];
  let me = null;
  let ssoAtivo = false;

  function fmtDateTime(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString("pt-BR");
    } catch {
      return iso;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function api(url, options = {}) {
    const res = await fetch(url, {
      cache: "no-store",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (res.status === 401) {
      location.replace("/login.html");
      throw new Error("Não autenticado");
    }
    if (res.status === 403) {
      location.replace("/");
      throw new Error("Sem permissão");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.erro || "Falha na requisição");
    }
    return data;
  }

  function applySsoUi() {
    if (!ssoAtivo) return;
    if (el.userFormHint) {
      el.userFormHint.textContent =
        "Convide a pessoa pelo e-mail. O SET SSO envia o convite; o papel continua neste sistema.";
    }
    if (el.usersListHint) {
      el.usersListHint.textContent =
        "Usuários novos entram pelo SSO. Os atuais podem ser ligados pelo e-mail.";
    }
    if (el.userLoginWrap) el.userLoginWrap.hidden = true;
    if (el.userEmailWrap) el.userEmailWrap.hidden = false;
    if (el.userSenhaWrap) el.userSenhaWrap.hidden = true;
    if (el.userLogin) el.userLogin.required = false;
    if (el.userSenha) el.userSenha.required = false;
    if (el.userEmail) el.userEmail.required = true;
  }

  async function loadMe() {
    const data = await api("/api/me");
    me = data.usuario;
    ssoAtivo = !!data.sso_ativo;
    if (!me) {
      location.replace("/login.html");
      return;
    }
    if (me.papel !== "admin") {
      location.replace("/");
    }
    applySsoUi();
  }

  async function loadUsers() {
    const data = await api("/api/usuarios");
    usuarios = data.usuarios || [];
    renderUsers();
  }

  function papelLabel(papel) {
    if (papel === "admin") return "Administrador";
    if (papel === "consulta") return "Consulta";
    if (papel === "reservas") return "Reservas";
    return "Editor";
  }

  function papelClass(papel) {
    if (papel === "admin") return "admin";
    if (papel === "consulta") return "consulta";
    if (papel === "reservas") return "reservas";
    return "editor";
  }

  function renderUsers() {
    el.userCount.textContent = `${usuarios.length} usuário(s)`;
    el.usersBody.innerHTML = usuarios
      .map((u) => {
        const papel = papelClass(u.papel);
        const ativo = u.ativo ? "ativo" : "inativo";
        const sso = u.sso_ligado ? " · SSO" : ssoAtivo ? " · local" : "";
        return `
          <tr>
            <td>
              <strong>${escapeHtml(u.usuario)}</strong>
              ${u.email ? `<div class="admin-email">${escapeHtml(u.email)}</div>` : ""}
            </td>
            <td>${escapeHtml(u.nome || "—")}</td>
            <td><span class="badge-papel ${papel}">${papelLabel(u.papel)}</span></td>
            <td><span class="badge-status ${ativo}">${u.ativo ? "Ativo" : "Inativo"}${sso}</span></td>
            <td>${escapeHtml(fmtDateTime(u.criado_em))}</td>
            <td>
              <button type="button" class="btn-run btn-small" data-edit-user="${u.id}">
                Editar
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function openEdit(id) {
    const user = usuarios.find((u) => String(u.id) === String(id));
    if (!user) return;
    el.editId.value = user.id;
    el.editTitle.textContent = user.usuario;
    el.editNome.value = user.nome || "";
    el.editEmail.value = user.email || "";
    el.editPapel.value = papelClass(user.papel);
    el.editAtivo.value = user.ativo ? "1" : "0";
    el.editSenha.value = "";
    el.editError.hidden = true;
    el.editDelete.style.display = me && me.id === user.id ? "none" : "";
    const ligado = !!user.sso_ligado;
    if (el.editSenhaWrap) el.editSenhaWrap.hidden = ligado;
    if (el.ligarSsoBox) {
      el.ligarSsoBox.hidden = !ssoAtivo || ligado;
      if (el.ligarSsoEmail) el.ligarSsoEmail.value = user.email || "";
    }
    if (el.btnReenviarConvite) {
      el.btnReenviarConvite.hidden = !ssoAtivo || !ligado;
    }
    el.dialog.showModal();
  }

  el.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    el.formError.hidden = true;
    try {
      const payload = {
        nome: el.userNome.value.trim(),
        papel: el.userPapel.value,
      };
      if (ssoAtivo) {
        payload.email = (el.userEmail.value || "").trim().toLowerCase();
        payload.usuario = payload.email;
      } else {
        payload.usuario = el.userLogin.value.trim();
        payload.senha = el.userSenha.value;
      }
      const data = await api("/api/usuarios", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      el.form.reset();
      el.userPapel.value = "editor";
      applySsoUi();
      if (data.aviso) {
        el.formError.textContent = data.aviso;
        el.formError.hidden = false;
      }
      await loadUsers();
    } catch (err) {
      el.formError.textContent = err.message || "Erro ao criar usuário";
      el.formError.hidden = false;
    }
  });

  el.usersBody.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-edit-user]");
    if (!btn) return;
    openEdit(btn.dataset.editUser);
  });

  el.editCancel.addEventListener("click", () => el.dialog.close());

  el.editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    el.editError.hidden = true;
    const id = el.editId.value;
    const payload = {
      nome: el.editNome.value.trim(),
      email: (el.editEmail.value || "").trim().toLowerCase(),
      papel: el.editPapel.value,
      ativo: el.editAtivo.value === "1",
    };
    if (el.editSenha.value && !el.editSenhaWrap.hidden) {
      payload.senha = el.editSenha.value;
    }
    try {
      await api(`/api/usuarios/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      el.dialog.close();
      await loadUsers();
    } catch (err) {
      el.editError.textContent = err.message || "Erro ao salvar";
      el.editError.hidden = false;
    }
  });

  el.editDelete.addEventListener("click", async () => {
    const id = el.editId.value;
    if (!id) return;
    if (!confirm("Excluir este usuário permanentemente?")) return;
    el.editError.hidden = true;
    try {
      await api(`/api/usuarios/${encodeURIComponent(id)}`, { method: "DELETE" });
      el.dialog.close();
      await loadUsers();
    } catch (err) {
      el.editError.textContent = err.message || "Erro ao excluir";
      el.editError.hidden = false;
    }
  });

  if (el.btnLigarSso) {
    el.btnLigarSso.addEventListener("click", async () => {
      const id = el.editId.value;
      const email = (el.ligarSsoEmail.value || el.editEmail.value || "").trim();
      if (!id || !email) {
        el.editError.textContent = "Informe o e-mail para ligar ao SSO.";
        el.editError.hidden = false;
        return;
      }
      el.editError.hidden = true;
      try {
        const data = await api(`/api/usuarios/${encodeURIComponent(id)}/ligar-sso`, {
          method: "POST",
          body: JSON.stringify({
            email,
            nome: el.editNome.value.trim(),
          }),
        });
        await loadUsers();
        openEdit(id);
        if (data.aviso) {
          el.editError.textContent = data.aviso;
          el.editError.hidden = false;
        }
      } catch (err) {
        el.editError.textContent = err.message || "Erro ao ligar ao SSO";
        el.editError.hidden = false;
      }
    });
  }

  if (el.btnReenviarConvite) {
    el.btnReenviarConvite.addEventListener("click", async () => {
      const id = el.editId.value;
      if (!id) return;
      el.editError.hidden = true;
      try {
        await api(`/api/usuarios/${encodeURIComponent(id)}/reenviar-convite`, {
          method: "POST",
        });
        el.editError.textContent = "Convite reenviado.";
        el.editError.hidden = false;
      } catch (err) {
        el.editError.textContent = err.message || "Erro ao reenviar convite";
        el.editError.hidden = false;
      }
    });
  }

  el.btnSair.addEventListener("click", async () => {
    const res = await fetch("/api/logout", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    location.replace(data.sso_logout || "/login.html");
  });

  if (el.btnVoltar) {
    el.btnVoltar.addEventListener("click", () => {
      if (window.history.length > 1 && document.referrer) {
        try {
          const ref = new URL(document.referrer);
          if (ref.origin === location.origin) {
            history.back();
            return;
          }
        } catch {
          /* ignore */
        }
      }
      location.href = "/portfolio.html";
    });
  }

  loadMe()
    .then(loadUsers)
    .catch((err) => {
      console.error(err);
      el.usersBody.innerHTML =
        '<tr><td colspan="6">Erro ao carregar usuários.</td></tr>';
    });
})();
