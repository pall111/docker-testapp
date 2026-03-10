#!/usr/bin/env python3
"""
Pull a Docker image from Artifactory by tag.

Usage:
    python3 scripts/pull_artifact.py <image-tag>

Environment variables required:
    ARTIFACTORY_URL   e.g. https://mycompany.jfrog.io/artifactory
    ARTIFACTORY_USER  your Artifactory username
    ARTIFACTORY_PASS  your Artifactory API key or password
    ARTIFACTORY_REPO  Docker repo name in Artifactory (default: docker-local)
"""

import subprocess
import os
import sys


def run(cmd: list[str], **kwargs) -> None:
    print(f"$ {' '.join(cmd)}")
    subprocess.run(cmd, check=True, **kwargs)


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python3 pull_artifact.py <image-tag>")
        sys.exit(1)

    image_tag = sys.argv[1]

    artifactory_url  = os.environ["ARTIFACTORY_URL"].rstrip("/")
    artifactory_user = os.environ["ARTIFACTORY_USER"]
    artifactory_pass = os.environ["ARTIFACTORY_PASS"]
    artifactory_repo = os.environ.get("ARTIFACTORY_REPO", "docker-local")
    app_name         = os.environ.get("APP_NAME", "docker-testapp")

    registry = artifactory_url.replace("https://", "").replace("http://", "")
    remote_image = f"{registry}/{artifactory_repo}/{app_name}:{image_tag}"

    print(f"\nPulling {remote_image}\n")

    # Login
    run(
        ["docker", "login", registry, "-u", artifactory_user, "--password-stdin"],
        input=artifactory_pass.encode(),
    )

    # Pull
    run(["docker", "pull", remote_image])

    # Logout
    run(["docker", "logout", registry])

    print(f"\nSuccessfully pulled: {remote_image}")
    print(f"Run with: docker run -p 5050:5050 {remote_image}")


if __name__ == "__main__":
    main()
