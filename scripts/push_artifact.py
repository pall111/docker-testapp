#!/usr/bin/env python3
"""
Push a Docker image to Artifactory.

Usage:
    python3 scripts/push_artifact.py <image-tag>

Environment variables required (set via Jenkins credentials / Vault):
    ARTIFACTORY_URL   e.g. https://mycompany.jfrog.io/artifactory
    ARTIFACTORY_USER  your Artifactory username
    ARTIFACTORY_PASS  your Artifactory API key or password
    ARTIFACTORY_REPO  Docker repo name in Artifactory (default: docker-local)
"""

import subprocess
import os
import sys


def run(cmd: list[str], **kwargs) -> None:
    """Run a shell command and raise on failure."""
    print(f"$ {' '.join(cmd)}")
    subprocess.run(cmd, check=True, **kwargs)


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python3 push_artifact.py <image-tag>")
        sys.exit(1)

    image_tag = sys.argv[1]

    artifactory_url  = os.environ["ARTIFACTORY_URL"].rstrip("/")
    artifactory_user = os.environ["ARTIFACTORY_USER"]
    artifactory_pass = os.environ["ARTIFACTORY_PASS"]
    artifactory_repo = os.environ.get("ARTIFACTORY_REPO", "docker-local")
    app_name         = os.environ.get("APP_NAME", "docker-testapp")

    registry = artifactory_url.replace("https://", "").replace("http://", "")
    remote_image = f"{registry}/{artifactory_repo}/{app_name}:{image_tag}"
    local_image  = f"pallavi3110/pallavisrepo:{image_tag}"

    print(f"\nPushing {local_image} → {remote_image}\n")

    # Login to Artifactory Docker registry
    run(
        ["docker", "login", registry, "-u", artifactory_user, "--password-stdin"],
        input=artifactory_pass.encode(),
    )

    # Tag the local image for Artifactory
    run(["docker", "tag", local_image, remote_image])

    # Push
    run(["docker", "push", remote_image])

    # Logout
    run(["docker", "logout", registry])

    print(f"\nSuccessfully pushed: {remote_image}")


if __name__ == "__main__":
    main()
