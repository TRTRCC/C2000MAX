#!/bin/sh
PKG_NAME=luci-app-fanctrl
DISPLAY_NAME=风扇控制
PKG_VERSION=1.0.0
PKG_ARCH=all

echo "=== Building $PKG_NAME $PKG_VERSION ==="

BUILD_DIR=/tmp/${PKG_NAME}_build
DATA_DIR=${BUILD_DIR}/data
CONTROL_DIR=${BUILD_DIR}/control
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

rm -rf ${BUILD_DIR}
mkdir -p ${DATA_DIR} ${CONTROL_DIR}

# Copy files
mkdir -p ${DATA_DIR}/etc/config
mkdir -p ${DATA_DIR}/etc/init.d
mkdir -p ${DATA_DIR}/etc/uci-defaults
mkdir -p ${DATA_DIR}/usr/sbin
mkdir -p ${DATA_DIR}/usr/libexec/rpcd
mkdir -p ${DATA_DIR}/www/luci-static/resources/view
mkdir -p ${DATA_DIR}/usr/share/luci/menu.d
mkdir -p ${DATA_DIR}/usr/share/rpcd/acl.d

cp ${SCRIPT_DIR}/src/etc/config/fanctrl ${DATA_DIR}/etc/config/fanctrl
cp ${SCRIPT_DIR}/src/etc/init.d/fanctrl ${DATA_DIR}/etc/init.d/fanctrl
cp ${SCRIPT_DIR}/src/etc/uci-defaults/90-luci-app-fanctrl ${DATA_DIR}/etc/uci-defaults/90-luci-app-fanctrl
cp ${SCRIPT_DIR}/src/usr/sbin/fanctrld ${DATA_DIR}/usr/sbin/fanctrld
cp ${SCRIPT_DIR}/src/usr/sbin/fanctrl-refresh-luci ${DATA_DIR}/usr/sbin/fanctrl-refresh-luci
cp ${SCRIPT_DIR}/src/usr/libexec/rpcd/fanctrl ${DATA_DIR}/usr/libexec/rpcd/fanctrl
cp ${SCRIPT_DIR}/src/www/luci-static/resources/view/fanctrl.js ${DATA_DIR}/www/luci-static/resources/view/fanctrl.js
cp ${SCRIPT_DIR}/src/usr/share/luci/menu.d/luci-app-fanctrl.json ${DATA_DIR}/usr/share/luci/menu.d/luci-app-fanctrl.json
cp ${SCRIPT_DIR}/src/usr/share/rpcd/acl.d/luci-app-fanctrl.json ${DATA_DIR}/usr/share/rpcd/acl.d/luci-app-fanctrl.json

chmod 755 ${DATA_DIR}/etc/init.d/fanctrl
chmod 755 ${DATA_DIR}/etc/uci-defaults/90-luci-app-fanctrl
chmod 755 ${DATA_DIR}/usr/sbin/fanctrld
chmod 755 ${DATA_DIR}/usr/sbin/fanctrl-refresh-luci
chmod 755 ${DATA_DIR}/usr/libexec/rpcd/fanctrl

INSTALLED_SIZE=$(cd ${DATA_DIR} && find . -type f | xargs du -bc | tail -1 | awk '{print $1}')

cat > ${CONTROL_DIR}/control <<EOF
Package: ${PKG_NAME}
Version: ${PKG_VERSION}
Depends: libc, rpcd, luci-base, jsonfilter
Source: luci-app-fanctrl
Section: luci
Architecture: ${PKG_ARCH}
Installed-Size: ${INSTALLED_SIZE}
Description: 风扇控制
Maintainer: 搞点薯条0007
EOF

cat > ${CONTROL_DIR}/postinst <<'ENDPOST'
#!/bin/sh
[ -n "${IPKG_NO_SCRIPT}" ] && exit 0
uci -q set fancontrol.settings.enabled='0'
uci commit fancontrol 2>/dev/null
/etc/init.d/fancontrol stop 2>/dev/null
/etc/init.d/fancontrol disable 2>/dev/null
rm -f /usr/lib/lua/luci/controller/fanctrl.lua 2>/dev/null
rm -f /usr/lib/lua/luci/view/fanctrl.htm 2>/dev/null
rm -f /tmp/luci-indexcache /tmp/luci-modulecache/* 2>/dev/null
if [ "$(uci -q get fanctrl.settings.curve_schema_version)" != "2" ]; then
    uci -q set fanctrl.settings.curve_schema_version='2'
    uci -q set fanctrl.silent=curve
    uci -q set fanctrl.silent.temps='45,55,65,75,85,95'
    uci -q set fanctrl.silent.speeds='8,15,28,42,62,82'
    uci -q set fanctrl.balanced=curve
    uci -q set fanctrl.balanced.temps='40,50,60,70,80,90'
    uci -q set fanctrl.balanced.speeds='20,35,52,68,84,100'
    uci -q set fanctrl.performance=curve
    uci -q set fanctrl.performance.temps='35,45,55,65,75,85'
    uci -q set fanctrl.performance.speeds='35,55,70,82,92,100'
    uci -q set fanctrl.custom=curve
    uci -q set fanctrl.custom.temps='35,50,65,80,95'
    uci -q set fanctrl.custom.speeds='20,35,55,75,100'
    uci commit fanctrl 2>/dev/null
fi
/etc/init.d/fanctrl enable 2>/dev/null
/etc/init.d/fanctrl start 2>/dev/null
exit 0
ENDPOST
chmod 755 ${CONTROL_DIR}/postinst

cat > ${CONTROL_DIR}/prerm <<'ENDPRE'
#!/bin/sh
/etc/init.d/fanctrl stop 2>/dev/null
/etc/init.d/fanctrl disable 2>/dev/null
exit 0
ENDPRE
chmod 755 ${CONTROL_DIR}/prerm

echo "2.0" > ${BUILD_DIR}/debian-binary

cd ${CONTROL_DIR} && tar czf ${BUILD_DIR}/control.tar.gz ./
cd ${DATA_DIR} && tar czf ${BUILD_DIR}/data.tar.gz ./

cd ${BUILD_DIR}
tar czf ${BUILD_DIR}/outer.tar.gz debian-binary data.tar.gz control.tar.gz
IPK_FILE=${SCRIPT_DIR}/${PKG_NAME}_${PKG_VERSION}.ipk
IPK_FILE_CN=${SCRIPT_DIR}/${DISPLAY_NAME}_${PKG_VERSION}.ipk
mv ${BUILD_DIR}/outer.tar.gz ${IPK_FILE_CN}
cp ${IPK_FILE_CN} ${IPK_FILE}

echo "=== Built: ${IPK_FILE_CN} ==="
ls -la ${IPK_FILE_CN}
ls -la ${IPK_FILE}

rm -rf ${BUILD_DIR}

echo "=== Install on router with: ==="
echo "    scp ${PKG_NAME}_${PKG_VERSION}.ipk root@192.168.7.1:/tmp/"
echo "    ssh root@192.168.7.1 'opkg install /tmp/${PKG_NAME}_${PKG_VERSION}.ipk'"
