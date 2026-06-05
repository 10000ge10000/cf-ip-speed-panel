include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-cf-ip-speed-client
PKG_VERSION:=0.1.0
PKG_RELEASE:=1
PKGARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-cf-ip-speed-client
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI support for cf-ip-speed-client
  DEPENDS:=+cf-ip-speed-client +luci-base
endef

define Build/Compile
endef

define Package/luci-app-cf-ip-speed-client/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/services
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/services/cf_ip_speed_client.js $(1)/www/luci-static/resources/view/services/cf_ip_speed_client.js
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-cf-ip-speed-client.json $(1)/usr/share/luci/menu.d/luci-app-cf-ip-speed-client.json
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-cf-ip-speed-client.json $(1)/usr/share/rpcd/acl.d/luci-app-cf-ip-speed-client.json
endef

$(eval $(call BuildPackage,luci-app-cf-ip-speed-client))
