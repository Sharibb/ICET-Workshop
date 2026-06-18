/**
 * GuardianBank — short root bypass (gokul1630/root / RootTools)
 *
 * Usage:
 *   frida -U -f com.demo.guardianbank \
 *     -l PPS_UAT/frida_scripts/_runtime_config.js \
 *     -l PPS_UAT/frida_scripts/_common.js \
 *     -l PPS_UAT/GuardianBank/guardianbank_root_bypass.js
 *
 * Or spawn after app start:
 *   frida -U com.demo.guardianbank -l PPS_UAT/GuardianBank/guardianbank_root_bypass.js
 */
"use strict";

var PKG = "com.demo.guardianbank";

Java.perform(function () {
    function hookBool(className, method) {
        try {
            var C = Java.use(className);
            C[method].implementation = function () {
                console.log("[ROOT-BYPASS] " + className + "." + method + "() -> false");
                return false;
            };
            console.log("[+] " + className + "." + method);
        } catch (e) {
            console.log("[-] " + className + "." + method + ": " + e);
        }
    }

    // GuardianBank RootDetector (same as RootPlugin.isRooted / isRootAvailable)
    hookBool(PKG + ".root.RootDetector", "isRooted");
    hookBool(PKG + ".root.RootDetector", "isRootAvailable");

    // Underlying gokul/root library (RootTools)
    hookBool("com.stericson.RootTools.RootTools", "isAccessGiven");
    hookBool("com.stericson.RootTools.RootTools", "isRootAvailable");

    console.log("[ROOT-BYPASS] Ready — restart app or pull-to-refresh; login should unlock.");
});
