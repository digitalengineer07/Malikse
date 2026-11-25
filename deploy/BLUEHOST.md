# Bluehost backend deployment

Pushes to `testing` that change `server/**`, the deployment script, or the workflow
deploy the backend to `129.121.184.197`. GitHub Actions also allows manual runs
from `testing`. Frontend-only changes do not restart the API.

The workflow uses the `malikse-deploy` user's `malikse-api` PM2 process. It builds in
GitHub first, uploads the exact commit, then installs and builds a separate release
on the VPS before switching the process. Expect a brief interruption during the
switch. A failed local readiness check restores the previous process. This does
not reverse database changes; database migrations are deliberately not run here.
The existing Production checks workflow remains independent; this deployment is
gated on a backend build and readiness, not the full production regression suite.

## One-time VPS setup

The API must already be migrated to `/srv/malikse/server` and running in the
`malikse-deploy` user's PM2. Its `.env` (mode 600) and uploads must be owned by that
user. `/srv/malikse` must be writable by that user. Port 22 must be reachable from
GitHub-hosted runners. The account must have no sudo or Docker-group privileges.
The deployment script refuses other usernames and explicitly selects
`/home/malikse-deploy/.pm2`.

This is Linux permission isolation, not a chroot or command-only key. The account
can run commands and access its home, application credentials, and publicly
readable files. It cannot administer Nginx, SSH, certificates, or root-owned
applications. Anyone able to deploy code can access Malikse's own credentials.

Run one-time administration commands in the Bluehost terminal as root:

```bash
apt update
apt install -y openssh-server curl util-linux
systemctl enable --now ssh
install -d -o malikse-deploy -g malikse-deploy -m 700 /home/malikse-deploy/.ssh
ssh-keygen -t ed25519 -C "github-malikse-restricted" -f /root/.ssh/github_malikse_restricted -N ""
```

If that key file already exists, do not overwrite it. Add its public key once:

```bash
printf 'restrict %s\n' "$(cat /root/.ssh/github_malikse_restricted.pub)" >> /home/malikse-deploy/.ssh/authorized_keys
chown malikse-deploy:malikse-deploy /home/malikse-deploy/.ssh/authorized_keys
chmod 600 /home/malikse-deploy/.ssh/authorized_keys
```

Obtain the two secret values locally in the VPS console (never post the private
key in chat, commit it, or include it in a screenshot):

```bash
cat /root/.ssh/github_malikse_restricted
```

Copy the whole private key, including BEGIN/END lines, to the GitHub secret below.
Obtain the host-key entry directly from this authenticated VPS console:

```bash
awk '{print "129.121.184.197 " $1 " " $2}' /etc/ssh/ssh_host_ed25519_key.pub
```

## GitHub secrets

In `devoxatechnologies/Malikse`, open **Settings → Secrets and variables → Actions
→ New repository secret**. Create:

| Name | Value |
| --- | --- |
| `BLUEHOST_SSH_PRIVATE_KEY` | Full private key generated above |
| `BLUEHOST_SSH_KNOWN_HOSTS` | The single host-key line printed by `awk` |

No database credentials, `.env`, GitHub PAT, or VPS password belong in this
workflow. The checked SSH host key prevents connecting to an unverified host.
If the VPS is reinstalled, verify and update this entry from its console.

## First deployment

Commit and push these files to `testing`:

- `.github/workflows/bluehost-deploy.yml`
- `deploy/bluehost.sh`
- `deploy/test-bluehost.sh`
- `deploy/BLUEHOST.md`

Open **Actions → Deploy backend to Bluehost** and watch the run. It is successful
only after the local readiness check and the external HTTPS `/ready` request pass.
The external check failing does not roll back an otherwise healthy local API;
check Nginx, firewall, or certificate renewal in that case.

Confirm reboot persistence once on the VPS:

```bash
runuser -l malikse-deploy -c 'pm2 save'
pm2 startup systemd -u malikse-deploy --hp /home/malikse-deploy
systemctl is-enabled pm2-malikse-deploy
```

Execute the command PM2 prints if requested. Keep the existing Nginx and Certbot
configuration: traffic still goes to port 5000, and certificates renew separately.

## Files and maintenance

- Current runtime secrets remain at `/srv/malikse/server/.env`.
- Uploads remain at `/srv/malikse/server/uploads`.
- Release folders are `/srv/malikse/deploy/releases/<commit>-<run>-<attempt>`.
- Each release links to the existing `.env` and upload directory.
- `/srv/malikse/deploy/current-release` records the last successful release.
- Release folders include a private `rollback.json` PM2 configuration. Never
  publish these folders or files. Keep at least the running and previous releases.
- Releases and uploaded archives are retained; monitor disk use and remove old,
  inactive releases when necessary. Failed builds also leave their release folder.
- After the first deployment, PM2 runs the release folder, not the original Git
  checkout. Do not run `git pull` in that checkout expecting it to update PM2.
- For an environment-only change, edit the shared `.env`, then run
  `runuser -l malikse-deploy -c 'pm2 restart malikse-api --update-env'` as root.

Troubleshooting commands (run on the VPS; avoid posting secrets from logs):

```bash
runuser -l malikse-deploy -c 'pm2 status'
runuser -l malikse-deploy -c 'pm2 logs malikse-api --lines 30 --nostream'
curl -fsS http://127.0.0.1:5000/ready
curl -fsS https://129.121.184.197/ready
```
