# Alterações

## 2026-11-04

- Recuperação de senha por e-mail, com tela para definir e confirmar a nova senha.
- Links de cadastro, reenvio e recuperação solicitam retorno ao endereço público do aplicativo.
- Links expirados mostram orientação para solicitar um novo e-mail.

Configuração necessária no Supabase: em Authentication → URL Configuration, definir Site URL como `https://lkpb-pixel.github.io/redesigned-guide/` e incluir o mesmo endereço em Redirect URLs. O código não altera essa configuração do projeto.
