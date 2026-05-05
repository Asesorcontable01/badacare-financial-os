# Badacare Financial OS

Dashboard SaaS di cash flow per Badacare. Frontend statico ospitato su GitHub Pages, backend su Google Apps Script collegato a un Google Sheet.

## Architettura

```
Browser  ──HTTPS──▶  GitHub Pages           (Index.html, CSS, JS — pubblico)
   │
   └──fetch JSON──▶  Apps Script Web App    (cashflow.gs — API privata)
                          │
                          └──▶ Google Sheets + Drive
```

Il vantaggio rispetto al deployment "puro Apps Script" è che gli utenti non vedono più la schermata di consenso *"Un utente di Google Apps Script ha creato questa applicazione"*. Accedono direttamente a un dominio web normale.

## Setup (una volta sola)

### 1. Backend (Apps Script)

1. Apri il foglio Google Sheets di Badacare.
2. Estensioni → Apps Script.
3. Incolla il contenuto di `cashflow.gs` come unico file di script (sostituisci tutto).
4. Salva (icona disco).
5. **Deploy → New deployment**:
   - Tipo: `Web app`
   - Description: `Badacare API v43`
   - Execute as: **Me** (il tuo account)
   - Who has access: **Anyone**
6. Click **Deploy**, autorizza l'accesso quando richiesto.
7. Copia l'URL che termina in `/exec` — sarà tipo:
   `https://script.google.com/macros/s/AKfycb..../exec`

### 2. Frontend (GitHub Pages)

1. Fork o crea un repo nuovo su GitHub (es. `badacare-financial-os`).
2. Carica `Index.html` (e questo `README.md`) nel repo.
3. Apri `Index.html` ed edita la riga:
   ```js
   const API_URL = "PASTE_YOUR_APPS_SCRIPT_DEPLOYMENT_URL_HERE";
   ```
   Incolla l'URL `/exec` copiato al punto 1.7.
4. Commit + push.
5. Su GitHub → repo → **Settings → Pages**:
   - Source: `Deploy from a branch`
   - Branch: `main` (o `master`), folder `/ (root)`
   - Save.
6. Aspetta 1-2 minuti. La tua app sarà su:
   `https://TUO_USERNAME.github.io/badacare-financial-os/`

### 3. Login

- Utente: `BADACARE`
- Password: `Badacare2026!`

Il login è solo client-side (deterrente). La protezione vera è il `SHARED_SECRET` nel backend Apps Script che blocca le chiamate API senza il token corretto.

## Come ruotare le credenziali

Se vuoi cambiare la password:

1. In `cashflow.gs` cambia `SHARED_SECRET = "..."` con la nuova password.
2. In `Index.html` cambia `API_SECRET = "..."` con la stessa password.
3. In `Index.html` cambia `VALID_PASS = "..."` con la stessa password (o una diversa, se vuoi che il login UI sia diverso dalla chiave API — funziona lo stesso).
4. Redeploy del web app Apps Script (sempre **New deployment** o **Manage deployments → New version**).
5. Commit + push del frontend su GitHub.

## Aggiornamenti futuri

- **Solo modifiche al frontend** (HTML/CSS/JS): basta `git push`. GitHub Pages si aggiorna automaticamente.
- **Modifiche al backend** (`cashflow.gs`): devi rifare il deploy su Apps Script (**Manage deployments → Edit (icona matita) → New version → Deploy**). L'URL `/exec` resta lo stesso.

## File del progetto

| File | Dove vive | Cosa fa |
|---|---|---|
| `Index.html` | GitHub Pages | UI completa (login, dashboard, matrice, modali) |
| `cashflow.gs` | Apps Script | API JSON che legge/scrive il Google Sheet |
| `README.md` | GitHub | Questo file |

## Compatibilità

- **Desktop** (Chrome, Edge, Safari, Firefox): pieno supporto.
- **Mobile** (iOS Safari, Chrome Android): pieno supporto. La sidebar diventa un drawer laterale (icona ☰ in alto a sinistra), le KPI si impilano in colonna singola, le tabelle hanno scroll orizzontale touch, la matrice analitica mantiene l'header sticky anche durante lo scroll.
- **Tablet** (iPad, Android tablets): layout intermedio con KPI a 2 colonne.
- Funziona offline a livello di UI (i fetch verso l'API ovviamente richiedono connessione).

## Sicurezza — note importanti

- ⚠️ Le credenziali di login (`BADACARE` / `Badacare2026!`) sono visibili nel sorgente HTML. Non sono protezione contro un attaccante motivato. Sono un *deterrente*.
- ⚠️ Il `SHARED_SECRET` è anch'esso visibile nel sorgente JS pubblico. Chi lo legge può chiamare l'API direttamente. Protegge contro bot casuali, non contro chi guarda il codice.
- ✅ Il Google Sheet rimane comunque protetto dai permessi Google: solo l'account che ha fatto il deploy può effettivamente leggere/scrivere (perché il deploy è "Execute as: Me").
- 🔒 Per sicurezza vera serve OAuth o autenticazione server-side. Se il dato sensibile diventa critico, si può migrare a Cloud Run o un vero backend.

## Troubleshooting

**La schermata resta su "Sincronizzazione dati..."**
→ Probabilmente `API_URL` non è configurato o il deployment Apps Script non è "Anyone access". Apri la console del browser (F12) per vedere l'errore.

**Errore "Unauthorized"**
→ `API_SECRET` in `Index.html` non coincide con `SHARED_SECRET` in `cashflow.gs`. Devono essere identici.

**Errore CORS**
→ Verifica che il deployment Apps Script sia su `Execute as: Me` e `Who has access: Anyone`. Il `Content-Type: text/plain` nel fetch è obbligatorio per evitare il preflight (già impostato in `api()`).

**"Il file è troppo grande" durante upload**
→ Apps Script ha un limite di ~50MB per richiesta. Per file più grandi serve refactoring con upload diretto a Drive.
