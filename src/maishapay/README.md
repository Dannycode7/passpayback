# Module MaishaPay - PassPayback

Ce dossier contient l'intégration officielle et complète de la passerelle **MaishaPay** pour les transactions financières (dépôts par Mobile Money, cartes bancaires et retraits).

---

## ⚙️ 1. Configuration des clés marchandes (.env)

Vos clés MaishaPay sont configurées dans le fichier `.env` :

```env
# Authentification Supabase
SUPABASE_URL="https://hmnnzfskkmlbddjnuntv.supabase.co"
SUPABASE_KEY="r0rYEze+1bu632M9rOhY0QyaAdhNgvSneL3wNZGTKKOiuVk+ko4JjSK9tjIpI847uZMtnPdLMc8rFeZqrokn/g=="

# Passerelle MaishaPay (Mode Sandbox)
MAISHAPAY_API_KEY='MP-SBPK-E0Opu2hoe05fRfJIwKHSvEKI$k0HAfAet5DEaz$xf0oIjryoY1sTQI$zpQZ3WRvoD$$0IGuEhfozJjDoeT16Y1/4t3NgJ9r$rIRi3D1l3eCdFyLmZGfyg2NO'
MAISHAPAY_SECRET_KEY='MP-SBPK-K0Qy7a1HF3BZ2sOOEu.Be7m$uaCylpsyMzO5k$jQHGxkMfq.TrNW0YDWNR1Hc11v4Ugh$j0TOYORAraQF62Avml0Y$GmWguKbXM5x3$GI2EgwV$H.ws2OVzW'
MAISHAPAY_ENV="sandbox"
MAISHAPAY_BASE_URL="https://marchand.maishapay.online/api"
MAISHAPAY_CALLBACK_URL="https://api.votredomaine.com/maishapay/webhook"
MAISHAPAY_RETURN_URL="https://app.votredomaine.com/wallet"
```

> **Note importante** : Les clés commençant par `MP-SBPK-` indiquent le mode **Sandbox** (`gatewayMode: 0`). Lorsque vous passerez en production, remplacez simplement par vos clés réelles (`MP-LIVEPK-` et `MP-LIVESK-`) et passez `MAISHAPAY_ENV="production"`.

---

## 📱 2. Numéros de test officiels en Sandbox

En mode Sandbox (`gatewayMode: 0`), vous pouvez simuler les différents scénarios de paiement Mobile Money avec ces numéros :

* **Paiement réussi (Validation PIN)** : `+243810000001`
* **Solde insuffisant** : `+243810000002`
* **Annulation / Timeout** : `+243810000003`

---

## 🚀 3. Endpoints de l'application

| Méthode | Route | Description | Auth requise |
|---|---|---|---|
| `POST` | `/maishapay/deposit` | Initie un paiement Mobile Money | Oui (Bearer token) |
| `POST` | `/maishapay/webhook` | Webhook IPN appelé par MaishaPay | Non (Public) |
| `GET` | `/maishapay/verify/:reference` | Vérifie le statut d'un paiement | Non / Public |
| `GET` | `/maishapay/deposits` | Historique des recharges du compte | Oui (Bearer token) |

---

## 🔄 4. Fonctionnement automatique

1. Le client initie une recharge de `20 USD` avec son numéro Mobile Money via `POST /maishapay/deposit`.
2. L'application crée une demande de dépôt (`DepositRequest`) en statut `PENDING`.
3. L'application appelle l'API REST MaishaPay (`https://marchand.maishapay.online/api/payment/rest/vers1.0/merchant`).
4. Le client reçoit l'invite USSD sur son téléphone pour taper son code PIN.
5. Dès validation, MaishaPay appelle automatiquement votre webhook `POST /maishapay/webhook`.
6. L'application :
   - Passe le `DepositRequest` en `APPROVED`.
   - **Crédite automatiquement le portefeuille (Wallet)** de l'utilisateur avec une transaction `CREDIT`.
