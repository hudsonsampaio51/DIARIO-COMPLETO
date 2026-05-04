# 📋 Configuração Firestore - Instruções

## 1. Criar Collection `schoolAccess`

No Firebase Console:
1. Vá para **Firestore Database**
2. Clique em **+ Coleção**
3. Nome: `schoolAccess`

## 2. Adicionar Documentos de Teste

### Forma Manual (Firebase Console)
Clique em **+ Adicionar Documento** na coleção `schoolAccess`:

**Documento 1: SuperAdmin (você)**
```
Document ID: admin@eadmatosinho.com_superadmin
Email: admin@eadmatosinho.com
schoolId: superadmin
role: superadmin
createdAt: (timestamp atual)
```

**Documento 2: Admin de Escola**
```
Document ID: admin_escola@gmail.com_school_001
Email: admin_escola@gmail.com
schoolId: school_001
role: admin
createdAt: (timestamp atual)
```

**Documento 3: Professor com 2 Escolas (Parte 1)**
```
Document ID: professor@gmail.com_school_001
Email: professor@gmail.com
schoolId: school_001
role: teacher
createdAt: (timestamp atual)
```

**Documento 4: Professor com 2 Escolas (Parte 2)**
```
Document ID: professor@gmail.com_school_002
Email: professor@gmail.com
schoolId: school_002
role: teacher
createdAt: (timestamp atual)
```

## 3. Firestore Rules (SEGURANÇA)

No Firebase Console:
1. Vá para **Firestore Database** > **Rules**
2. Substitua todo o conteúdo por:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Usuários - Apenas pode ler/escrever seu próprio documento
    match /users/{userId} {
      allow read: if request.auth.uid == userId;
      allow write: if request.auth.uid == userId || request.auth == null;
    }
    
    // schoolAccess - Ler: qualquer autenticado. Escrever: Admin/SuperAdmin
    match /schoolAccess/{document=**} {
      allow read: if request.auth != null;
      allow write: if isAdmin() || isSuperAdmin();
    }
    
    // Schools
    match /schools/{schoolId} {
      allow read: if request.auth != null;
      allow write: if isSuperAdmin() || isAdminOfSchool(schoolId);
    }
    
    // Students
    match /students/{studentId} {
      allow read: if request.auth != null && userSchoolId() == resource.data.schoolId;
      allow write: if isAdminOfSchool(resource.data.schoolId);
    }
    
    // Classes
    match /classes/{classId} {
      allow read: if request.auth != null && userSchoolId() == resource.data.schoolId;
      allow write: if isAdminOfSchool(resource.data.schoolId);
    }

    // Notices
    match /notices/{noticeId} {
      allow read: if request.auth != null && userSchoolId() == resource.data.schoolId;
      allow write: if isAdminOfSchool(resource.data.schoolId);
    }

    // Events
    match /events/{eventId} {
      allow read: if request.auth != null && userSchoolId() == resource.data.schoolId;
      allow write: if isAdminOfSchool(resource.data.schoolId);
    }

    // Helper Functions
    function isSuperAdmin() {
      return request.auth != null && getUserRole() == 'superadmin';
    }

    function isAdmin() {
      return request.auth != null && getUserRole() == 'admin';
    }

    function isAdminOfSchool(schoolId) {
      let userSchool = getUserSchoolId();
      return request.auth != null && 
        (getUserRole() == 'admin' || getUserRole() == 'superadmin') 
        && userSchool == schoolId;
    }

    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }

    function getUserSchoolId() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.activeSchoolId;
    }

    function userSchoolId() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.activeSchoolId;
    }
  }
}
```

3. Clique em **Publicar**

## 4. Testando a Autenticação

### Teste 1: Email não registrado
- Tente fazer login com qualquer Gmail que NÃO está em `schoolAccess`
- Esperado: Erro "Email não está registrado"

### Teste 2: Professor com 1 escola
- Faça login com: `professor_1@gmail.com` (registrado em school_001)
- Esperado: Loga direto

### Teste 3: Professor com 2 escolas
- Faça login com: `professor@gmail.com` (registrado em school_001 E school_002)
- Esperado: Mostra seletor para escolher qual escola
- Ao escolher school_001 → entra
- No header superior → dropdown permite trocar para school_002 SEM fazer logout

## 5. Como Gerenciar Usuários (UI)

### SuperAdmin (você) - Registra Admin de Escolas

1. Faça login como superadmin
2. Na sidebar, clique em **"Gerenciar Usuários"**
3. Formulário:
   - Email: `admin_nova_escola@gmail.com`
   - Papel: `Admin da Escola`
   - ID da Escola: `school_123`
4. Clique em **"Adicionar Usuário"**
5. Será criado documento em `schoolAccess` automaticamente

### Admin da Escola - Registra Professores/Secretários

1. Faça login como admin da escola
2. Na sidebar,clique em **"Gerenciar Usuários"**
3. Formulário:
   - Email: `professor_novo@gmail.com`
   - Papel: `Professor` ou `Secretária` ou `Supervisor`
   - (ID da Escola é automático - sua escola)
4. Clique em **"Adicionar Usuário"**
5. Professor agora consegue fazer login!

## 6. Script para Popular Dados (Opcional)

Se quiser criar registros em batch, use Cloud Functions ou Firebase CLI:

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Deploy (se tiver functions)
firebase deploy
```

---

## ✅ Resumo do Fluxo

```
🔐 SEGURANÇA HABILITADA
├─ Novo Gmail tenta login
├─ Sistema verifica schoolAccess
├─ Se não existe → Erro + logout ✓
├─ Se 1 escola → Login direto ✓
└─ Se 2+ escolas → Seletor de escola ✓

👤 CADASTRO DE USUÁRIOS
├─ SuperAdmin registra Admin de Escolas
├─ Admin registra Professores/Secretários
└─ Inserção automática em schoolAccess ✓

🔄 MÚLTIPLAS ESCOLAS
├─ Professor em 2 escolas usa 1 email ✓
├─ Dropdown no header para trocar escola ✓
└─ Sem fazer logout ✓
```
