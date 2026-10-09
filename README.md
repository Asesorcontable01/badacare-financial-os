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
3. Apri `index.html` ed edita la riga `const API_URL = "...";`
   incollando l'URL `/exec` copiato al punto 1.7.
4. Commit + push.
5. Su GitHub → repo → **Settings → Pages**:
   - Source: `Deploy from a branch`
   - Branch: `main` (o `master`), folder `/ (root)`
   - Save.
6. Aspetta 1-2 minuti. La tua app sarà su:
   `https://TUO_USERNAME.github.io/badacare-financial-os/`

### 3. Login

- Utente: `BADACARE`
- Password: la stessa di `SHARED_SECRET` in `cashflow.gs` (non è scritta nel frontend).

Dalla v45 la password non è più nel codice pubblico: al login viene inviata al backend, che la confronta con `SHARED_SECRET`. Se è corretta la sessione resta aperta finché non si chiude la scheda (sessionStorage).

## Come cambiare la password

1. In Apps Script cambia `const SHARED_SECRET = "...";` con la nuova password.
2. **Deploy → Manage deployments → Edit → New version → Deploy** (l'URL `/exec` resta lo stesso).
3. Fatto: non serve toccare `index.html`. Chi è collegato con la vecchia password viene riportato al login.

## Aggiornamenti futuri

- **Solo modifiche al frontend** (HTML/CSS/JS): basta `git push`. GitHub Pages si aggiorna automaticamente.
- **Modifiche al backend** (`cashflow.gs`): devi rifare il deploy su Apps Script (**Manage deployments → Edit (icona matita) → New version → Deploy**). L'URL `/exec` resta lo stesso.

## File del progetto

| File | Dove vive | Cosa fa |
|---|---|---|
| `index.html` | GitHub Pages | UI completa (login, dashboard, matrice, modali, export Excel .xlsx) |
| `cashflow.gs` | Apps Script | API JSON che legge/scrive il Google Sheet |
| `README.md` | GitHub | Questo file |

## Compatibilità

- **Desktop** (Chrome, Edge, Safari, Firefox): pieno supporto.
- **Mobile** (iOS Safari, Chrome Android): pieno supporto. La sidebar diventa un drawer laterale (icona ☰ in alto a sinistra), le KPI si impilano in colonna singola, le tabelle hanno scroll orizzontale touch, la matrice analitica mantiene l'header sticky anche durante lo scroll.
- **Tablet** (iPad, Android tablets): layout intermedio con KPI a 2 colonne.
- Funziona offline a livello di UI (i fetch verso l'API ovviamente richiedono connessione).

## Sicurezza — note importanti

- ✅ La password (`SHARED_SECRET`) vive solo in Apps Script: il frontend pubblico non la contiene.
- ⚠️ Le versioni precedenti alla v45 avevano la password scritta nel codice e in questo README: se non l'hai già fatto, cambiala (vedi sopra).
- ✅ Il Google Sheet rimane comunque protetto dai permessi Google: solo l'account che ha fatto il deploy può effettivamente leggere/scrivere (perché il deploy è "Execute as: Me").
- 🔒 Per sicurezza vera serve OAuth o autenticazione server-side. Se il dato sensibile diventa critico, si può migrare a Cloud Run o un vero backend.

## Troubleshooting

**La schermata resta su "Sincronizzazione dati..."**
→ Probabilmente `API_URL` non è configurato o il deployment Apps Script non è "Anyone access". Apri la console del browser (F12) per vedere l'errore.

**"Utente o password non corretti" con la password giusta**
→ Controlla `SHARED_SECRET` in Apps Script e che il deploy sia stato aggiornato a una nuova versione.

**Errore CORS**
→ Verifica che il deployment Apps Script sia su `Execute as: Me` e `Who has access: Anyone`. Il `Content-Type: text/plain` nel fetch è obbligatorio per evitare il preflight (già impostato in `api()`).

**"Il file è troppo grande" durante upload**
→ Apps Script ha un limite di ~50MB per richiesta. Per file più grandi serve refactoring con upload diretto a Drive.
