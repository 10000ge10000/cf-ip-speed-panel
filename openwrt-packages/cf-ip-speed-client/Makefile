include $(TOPDIR)/rules.mk

PKG_NAME:=cf-ip-speed-client
PKG_VERSION:=0.1.0
PKG_RELEASE:=1
PKGARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/cf-ip-speed-client
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Cloudflare preferred IP public test client
  DEPENDS:=+curl +ca-bundle +ip-full +jsonfilter
endef

define Package/cf-ip-speed-client/description
  OpenWrt client for cf-ip-speed-panel. It runs cfst, checks whether traffic
  is likely direct, and uploads speed test results to a Worker endpoint.
endef

define Build/Compile
endef

define Package/cf-ip-speed-client/conffiles
/etc/config/cf_ip_speed_client
/etc/cf-ip-speed-client/ip.txt
endef

define Package/cf-ip-speed-client/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/cf_ip_speed_client $(1)/etc/config/cf_ip_speed_client
	$(INSTALL_DIR) $(1)/etc/cf-ip-speed-client
	$(INSTALL_DATA) ./files/etc/cf-ip-speed-client/ip.txt $(1)/etc/cf-ip-speed-client/ip.txt
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/cf-ip-speed-client $(1)/etc/init.d/cf-ip-speed-client
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/usr/bin/cf-ip-speed-client $(1)/usr/bin/cf-ip-speed-client
endef

$(eval $(call BuildPackage,cf-ip-speed-client))
