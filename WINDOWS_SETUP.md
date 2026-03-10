# Windows Setup Guide
## Node.js App + MongoDB + Docker + Minikube + Jenkins

---

## Prerequisites

Install the following tools in order. After each install, **close and reopen PowerShell** to reload the PATH.

| Tool | Download Link | Notes |
|---|---|---|
| Docker Desktop | https://www.docker.com/products/docker-desktop/ | Switch to **Linux containers** after install |
| Minikube | https://minikube.sigs.k8s.io/docs/start/ | Choose Windows AMD64 installer |
| kubectl | Bundled with Docker Desktop | Or download from https://kubernetes.io/docs/tasks/tools/install-kubectl-windows/ |
| Git | https://git-scm.com/download/win | Use default options |

> **Open PowerShell as Administrator** for all commands below.

---

## Part 1 — Clone the Repository

```powershell
git clone https://github.com/pallavi3110/docker-testapp.git
cd docker-testapp
```

---

## Part 2 — Docker Setup

### 2.1 Start Docker Desktop

- Open Docker Desktop from the Start menu
- Right-click the Docker tray icon → **Switch to Linux containers** (if not already set)
- Wait until it shows **"Docker Desktop is running"**

### 2.2 Login to DockerHub

```powershell
docker login
# Enter your DockerHub username and password when prompted
```

### 2.3 Build and Push the Image

```powershell
docker build -t pallavi3110/pallavisrepo:3.0 .
docker push pallavi3110/pallavisrepo:3.0
```

---

## Part 3 — Minikube + Kubernetes Setup

### 3.1 Start Minikube

```powershell
minikube start --driver=docker
```

Verify it is running:

```powershell
minikube status
kubectl get nodes
```

Expected output:
```
minikube
type: Control Plane
host: Running
kubelet: Running
apiserver: Running
kubeconfig: Configured
```

### 3.2 Create Namespace

```powershell
kubectl apply -f k8s/namespace.yaml
```

### 3.3 Apply Kubernetes Secrets

```powershell
kubectl apply -f k8s/mongo-secret.yaml
```

### 3.4 Deploy MongoDB

```powershell
# Simple single-node MongoDB (use this for development)
kubectl apply -f mongo-deployment.yaml

# Wait for mongo pod to be Running
kubectl get pods -n testapp-ns -w
# Press Ctrl+C once STATUS = Running
```

### 3.5 Deploy the Node.js App

```powershell
kubectl apply -f testapp-deployment.yaml

# Watch both pods
kubectl get pods -n testapp-ns -w
```

Both pods should show `1/1 Running`:
```
NAME                      READY   STATUS    RESTARTS
mongo-xxxxxxxx-xxxxx      1/1     Running   0
testapp-xxxxxxxx-xxxxx    1/1     Running   0
```

### 3.6 Access the Application

```powershell
minikube service testapp -n testapp-ns --url
```

This prints a URL like `http://127.0.0.1:XXXXX`.

Open in browser:
- `http://127.0.0.1:XXXXX/getUsers` → returns `[]` (empty, no users yet)
- `http://127.0.0.1:XXXXX/health` → returns `{"status":"ok","db":"connected"}`

### 3.7 Test the API

```powershell
# Add a user
curl -X POST http://127.0.0.1:XXXXX/addUser `
     -H "Content-Type: application/x-www-form-urlencoded" `
     -d "name=Pallavi&email=pallavi@test.com"

# Get all users
curl http://127.0.0.1:XXXXX/getUsers
```

---

## Part 4 — Jenkins Setup

### 4.1 Run Jenkins in Docker

```powershell
docker run -d `
  --name jenkins `
  -p 8080:8080 `
  -p 50000:50000 `
  -v jenkins_home:/var/jenkins_home `
  -v //var/run/docker.sock:/var/run/docker.sock `
  -v C:\Users\offic\.kube:/root/.kube `
  -v C:\Users\offic\.minikube:/root/.minikube `
  jenkins/jenkins:lts
```

> Replace `offic` with your actual Windows username if different.

### 4.2 Install kubectl Inside Jenkins

```powershell
docker exec -u root jenkins bash -c "curl -LO https://dl.k8s.io/release/v1.29.0/bin/linux/amd64/kubectl && chmod +x kubectl && mv kubectl /usr/local/bin/"
```

### 4.3 Install Node.js 18 Inside Jenkins

```powershell
docker exec -u root jenkins bash -c "curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && apt-get install -y nodejs"
```

### 4.4 Fix Kubeconfig Windows Paths

Windows paths in the mounted kubeconfig won't work inside the Linux container. Copy and fix them:

```powershell
docker exec -u root jenkins bash -c "cp /root/.kube/config /root/.kube/config.local && sed -i 's|C:\\Users\\offic|/root|g' /root/.kube/config.local"
```

Verify no Windows paths remain:

```powershell
docker exec -u root jenkins bash -c "cat /root/.kube/config.local | grep server"
# Should show: server: https://127.0.0.1:XXXXX
```

### 4.5 Verify all tools are installed

```powershell
docker exec jenkins node --version     # v18.x.x
docker exec jenkins npm --version      # 9.x.x or 10.x.x
docker exec jenkins kubectl version --client   # v1.29.0
docker exec jenkins docker --version   # Docker version 2x.x
```

### 4.6 Unlock Jenkins

1. Get the initial admin password:

```powershell
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

2. Open `http://localhost:8080` in your browser
3. Paste the password into the unlock screen
4. Click **"Install suggested plugins"** and wait
5. Create your admin user:
   - Username: `admin` (or your choice)
   - Password: choose a strong password
   - Full name and email: fill in
6. Click **Save and Finish** → **Start using Jenkins**

### 4.7 Install Extra Plugins

1. Go to **Manage Jenkins → Plugins → Available plugins**
2. Search and install each of these (tick the checkbox, then click Install):
   - `Docker Pipeline`
   - `NodeJS`
   - `Git`
   - `Pipeline`
3. Tick **"Restart Jenkins when installation is complete"**

### 4.8 Add DockerHub Credentials

1. Go to **Manage Jenkins → Credentials**
2. Click **System → Global credentials (unrestricted)**
3. Click **Add Credentials**

Fill in:

| Field | Value |
|---|---|
| Kind | `Username with password` |
| Scope | `Global` |
| Username | `pallavi3110` |
| Password | your DockerHub password |
| ID | `dockerhub-creds` |
| Description | `DockerHub - pallavi3110` |

Click **Create**.

> If your GitHub repo is **private**, add a second credential:
> - Kind: `Username with password`
> - Username: your GitHub username
> - Password: your GitHub Personal Access Token (from https://github.com/settings/tokens — with `repo` scope)
> - ID: `github-creds`

### 4.9 Create the Pipeline Job

1. Click **New Item** on the Jenkins home page
2. Enter name: `docker-testapp`
3. Select **Pipeline** → click **OK**
4. Scroll down to the **Pipeline** section
5. Set **Definition** to `Pipeline script from SCM`
6. Set **SCM** to `Git`
7. Set **Repository URL** to:
   ```
   https://github.com/pallavi3110/docker-testapp.git
   ```
8. Set **Branch Specifier** to `*/main`
9. Set **Script Path** to `Jenkinsfile`
10. Click **Save**

### 4.10 Run the Pipeline

1. Click your `docker-testapp` job
2. Click **Build with Parameters** (left sidebar)
3. Set `BRANCH` = `main`
4. Click **Build**
5. Click the build number that appears → **Console Output** to watch logs live

Expected stage results:
```
✓ Clone          ~5s
✓ Install        ~15s
✓ Lint           ~3s
✓ Unit Tests     ~5s    (8 tests pass)
✓ Build Image    ~45s
✓ Push Artifacts ~20s
✓ Deploy to K8s  ~10s
```

---

## Part 5 — GitHub Webhook (Auto-trigger on push)

This makes Jenkins run automatically every time you push code to GitHub.

1. Go to your GitHub repo → **Settings → Webhooks → Add webhook**
2. Fill in:
   - Payload URL: `http://<YOUR-WINDOWS-IP>:8080/github-webhook/`
   - Content type: `application/json`
   - Which events: **Just the push event**
3. Click **Add webhook**

Find your Windows IP:

```powershell
ipconfig
# Look for: IPv4 Address . . . . . . . : 192.168.x.x
```

> **Note:** For GitHub to reach your local machine, you need your PC to be accessible from the internet, or use a tunnelling tool like [ngrok](https://ngrok.com):
> ```powershell
> ngrok http 8080
> # Use the https://xxxx.ngrok.io URL as your webhook Payload URL
> ```

---

## Part 6 — Jenkins User Roles

Set up admin vs developer access as required.

1. Go to **Manage Jenkins → Security**
2. Under **Authorization**, select **Matrix-based security**
3. Add users:

| User | Permissions |
|---|---|
| Professor account | Full `Administer` checkbox |
| 1 student admin | Full `Administer` checkbox |
| All other students | `Job: Build, Cancel, Read` + `View: Read` only |

4. Click **Save**

---

## Part 7 — Useful Commands Reference

### Kubernetes

```powershell
# Check pods
kubectl get pods -n testapp-ns

# Check logs
kubectl logs deployment/testapp -n testapp-ns
kubectl logs deployment/mongo -n testapp-ns

# Restart a deployment
kubectl rollout restart deployment testapp -n testapp-ns

# Get the app URL
minikube service testapp -n testapp-ns --url

# Shell into a pod
kubectl exec -it deployment/testapp -n testapp-ns -- /bin/sh
```

### Docker

```powershell
# Rebuild and push new image
docker build -t pallavi3110/pallavisrepo:3.0 .
docker push pallavi3110/pallavisrepo:3.0

# Then redeploy in Kubernetes
kubectl rollout restart deployment testapp -n testapp-ns
```

### Jenkins

```powershell
# Stop Jenkins
docker stop jenkins

# Start Jenkins again
docker start jenkins

# View Jenkins logs
docker logs jenkins

# Restart Jenkins container
docker restart jenkins
```

### Minikube

```powershell
# Stop cluster (saves state)
minikube stop

# Start cluster again
minikube start --driver=docker

# Delete cluster completely (fresh start)
minikube delete

# Open Kubernetes dashboard in browser
minikube dashboard
```

---

## Part 8 — Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `db is undefined` | MongoDB not ready when request arrived | `kubectl rollout restart deployment testapp -n testapp-ns` |
| `ECONNREFUSED mongo-service:27017` | Mongo pod not Running yet | Wait 30s, the retry loop will connect automatically |
| `selector is immutable` | Old deployment has different labels | `kubectl delete deployment mongo -n testapp-ns` then reapply |
| `image pull failed` | Wrong image tag or not pushed | Rebuild with `docker build` and `docker push` first |
| Jenkins `permission denied` on kubeconfig | Windows mount is read-only | Use `config.local` copy (Step 4.4 above) |
| Jenkins `unauthorized` on DockerHub push | Wrong password in credential | Update `dockerhub-creds` in Jenkins credentials manager |
| Webhook not triggering Jenkins | GitHub can't reach `localhost` | Use ngrok tunnel (Step 5 above) |

---

## Architecture Overview

```
Developer (VS Code)
      │
      │  git push
      ▼
   GitHub Repo
      │
      │  webhook trigger
      ▼
   Jenkins (Docker container on Windows)
      │
      ├─ Stage: Clone → npm install → Lint → Unit Tests
      │
      ├─ Stage: docker build → docker push → DockerHub
      │
      └─ Stage: kubectl rollout restart → Minikube
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
     testapp Pod              mongo Pod
     (Node.js :5050)    (MongoDB :27017)
            │                       │
            └──── mongo-service ────┘
                  (ClusterIP DNS)
```
