#!/bin/bash
set -e

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")

echo "Building RPM for version ${VERSION}..."

# Clean and build
npm run build

# Create tarball structure
TMPDIR=$(mktemp -d)
PKGDIR="${TMPDIR}/cockpit-sudo-manager-${VERSION}/sudo-manager"

mkdir -p "${PKGDIR}"

# Copy runtime files only (not source)
cp -r dist/* "${PKGDIR}/"
cp -r backend "${PKGDIR}/"
cp -r sudo-commands.d "${PKGDIR}/"
mkdir -p "${PKGDIR}/templates"
cp templates/user.sudoers.tpl "${PKGDIR}/templates/"
cp manifest.json "${PKGDIR}/"
cp LICENSE "${PKGDIR}/"
cp README.md "${PKGDIR}/"

# Create tarball
cd "${TMPDIR}"
tar czf "cockpit-sudo-manager-${VERSION}.tar.gz" "cockpit-sudo-manager-${VERSION}/"

# Move to current directory
mv "cockpit-sudo-manager-${VERSION}.tar.gz" "${OLDPWD}/"

# Cleanup
rm -rf "${TMPDIR}"

echo "Created cockpit-sudo-manager-${VERSION}.tar.gz"
echo ""
echo "To build RPM:"
echo "  rpmbuild -tb cockpit-sudo-manager-${VERSION}.tar.gz"
