# Mobile App VAPT Workshop — Talking Points (2 Hours)

**Format:** PPT-style slides in Markdown  
**Audience:** Security testers / developers  
**Lab app:** GuardianBank (`com.demo.guardianbank`) — fictional, workshop-only  
**Tools:** Android emulator (rooted), ADB, Frida 17.x  

**Total time:** 120 minutes  

---

## Slide 1 — Title

# Mobile Banking App Security Testing  
## Hands-on with Frida & GuardianBank

**Subtitle:** Root detection, command injection, and insecure storage — demo safely in a lab

**Say:**
> “Today we use a **fictional** banking app called GuardianBank. Nothing connects to a real bank. You’ll learn **how** mobile findings are proven, not just named.”

**Time:** 0:00 – 0:05 (5 min)

---

## Slide 2 — Housekeeping

### Before we start

- Phones on silent; questions anytime — save deep dives for breaks  
- **Do not** test these techniques on apps you don’t own or without permission  
- Lab APK, scripts, and notes live in `PPS_UAT/GuardianBank/`  
- Rooted **x86_64** emulator recommended  

**Say:**
> “Ethics first: authorized testing only. Our APK is a **deliberate teaching clone** of patterns seen in real Flutter banking apps.”

**Time:** 0:05 – 0:08 (3 min)

---

## Slide 3 — Agenda (2 hours)

| Block | Topic | Minutes |
|-------|--------|---------|
| 1 | Why mobile banking is different | 10 |
| 2 | Lab setup (ADB + Frida + APK) | 15 |
| 3 | GuardianBank walkthrough | 10 |
| 4 | **Root detection** — how & bypass | 20 |
| — | ☕ **Break** | 10 |
| 5 | **Command injection** — theory + live PoC | 35 |
| 6 | Insecure storage (M6) — quick demo | 10 |
| 7 | Reporting & wrap-up | 10 |

**Say:**
> “We spend the most time on **command injection** because that’s where Frida, Java hooks, and real impact meet.”

**Time:** 0:08 – 0:10 (2 min)

---

# BLOCK 1 — Context (10 min)

---

## Slide 4 — Real apps vs what you see in JADX

### Flutter banking apps = two layers

| Layer | Where | What you get |
|-------|--------|----------------|
| **Java/Kotlin shell** | `MainActivity`, plugins | Small — often &lt; 20 app files |
| **Dart UI + logic** | `libapp.so` | Login, OTP, API crypto — **not** full source in JADX |

**Say:**
> “Decompiled `Source_Code` folders show **plugins** (root, SMS, toast), not the whole bank. That’s why we built **GuardianBank** natively for clear demos.”

**Visual:** Diagram — APK → Java wrapper → Flutter engine → libapp.so

**Time:** 0:10 – 0:15 (5 min)

---

## Slide 5 — Typical findings in mobile banking VAPT

### What assessors look for

1. **TLS / pinning** — Can traffic be intercepted?  
2. **Root / emulator** — Does the app refuse compromised devices?  
3. **Sensitive plugins** — e.g. [gokul/root](https://github.com/gokul1630/root) — shell access from Dart  
4. **Storage** — Tokens, OTP, clipboard, backups  
5. **Client crypto** — Keys, reversible encryption  

**Say:**
> “Today we hit **#2, #3, and #4** live. Pinning and API crypto are separate modules — same toolkit, different scripts.”

**Time:** 0:15 – 0:20 (5 min)

---

# BLOCK 2 — Lab setup (15 min)

---

## Slide 6 — Your lab checklist

### Install & verify

```powershell
adb devices
adb install -r PPS_UAT\GuardianBank\GuardianBank-workshop-debug.apk
frida --version
```

**Expected:** emulator `device`, Frida ≥ 16, app **GuardianBank** on home screen  

**Say:**
> “If `adb devices` is empty, fix USB debugging or start the AVD before we continue.”

**Time:** 0:20 – 0:25 (5 min) — *hands-on*

---

## Slide 7 — Frida spawn vs attach

### Two ways to inject

| Mode | Command flag | When to use |
|------|--------------|-------------|
| **Spawn** | `-f com.demo.guardianbank` | Hooks must run **before** app logic (root check) |
| **Attach** | `-n GuardianBank` | App already running; good for logging only |

**Say:**
> “Rule of thumb: **spawn** for bypass scripts. If the app already showed ‘root detected,’ kill it and spawn again with Frida.”

**Time:** 0:25 – 0:30 (5 min)

---

## Slide 8 — Frida script anatomy (30 sec version)

### Every Java hook script needs:

1. `"use strict";`  
2. `Java.perform(function () { ... });`  
3. `Java.use("full.class.Name")`  
4. `.implementation = function (...) { ... }`  
5. Optional: `rpc.exports` for REPL commands  

**Mnemonic:** **J → use → hook → (optional) RPC**

**Say:**
> “If you remember only one line: **`Java.perform`**. Without it, nothing attaches.”

**Time:** 0:30 – 0:35 (5 min)

---

# BLOCK 3 — GuardianBank app (10 min)

---

## Slide 9 — Meet GuardianBank

### What the lab app does

- **Brand:** GuardianBank (no real bank names)  
- **Flow:** Mobile number → Fetch OTP → Verify login  
- **Root check:** Same stack as gokul/root — `RootTools` + `libsu`  
- **Package:** `com.demo.guardianbank`  

**Demo:** Open app **without** Frida → red banner on rooted AVD  

**Say:**
> “On a rooted emulator the app **blocks login**. That’s intentional — we’ll break it in ten minutes.”

**Time:** 0:35 – 0:40 (5 min)

---

## Slide 10 — Where root check lives in code

```java
// RootDetector.java (same idea as RootPlugin)
RootTools.isAccessGiven()      → isRooted()
RootTools.isRootAvailable()    → isRootAvailable()
```

**Say:**
> “The Flutter original uses plugin method names `isRooted` / `ExecuteCommand`. GuardianBank calls the **same libraries** directly so the PoC still applies.”

**Time:** 0:40 – 0:45 (5 min)

---

# BLOCK 4 — Root detection & bypass (20 min)

---

## Slide 11 — Why banks block rooted devices

### Risk story for stakeholders

- Root = other apps / malware can read memory & hooks  
- Frida on rooted device = full control  
- **Client-side check** = UX gate, **not** a crypto boundary  

**Say:**
> “Root detection is **risk reduction**, not a fix. We prove it can be bypassed in one short script.”

**Time:** 0:45 – 0:50 (5 min)

---

## Slide 12 — Root bypass script (concept)

### File: `guardianbank_root_bypass.js`

```
Hook isRooted()        → return false
Hook isRootAvailable() → return false
Hook RootTools.*       → return false  (belt & suspenders)
```

**Live demo:**

```powershell
frida -U -f com.demo.guardianbank -l PPS_UAT\GuardianBank\guardianbank_root_bypass.js
```

**Expected:** Green banner, login enabled  

**Say:**
> “We’re not removing root from the device — we **lie to the app** at the Java method return value.”

**Time:** 0:50 – 1:00 (10 min) — *live demo + Q&A*

---

## Slide 13 — Hook pattern (write on board)

```
orig = Class.method
Class.method.implementation = function () {
    log("bypass")
    return false          // or orig.call(this, ...) to preserve behavior
}
```

**Say:**
> “Two patterns: **replace return** (bypass) or **call original** (logging). Command injection uses the second.”

**Time:** 1:00 – 1:05 (5 min)

---

## ☕ BREAK — 10 minutes

**Time:** 1:05 – 1:15

---

# BLOCK 5 — Command injection (35 min)

---

## Slide 14 — Section title

# Command Injection  
## From Flutter plugin to `Shell.cmd`

**Say:**
> “This is the **core** of the second hour. Same vulnerability class as server-side OS command injection — different sink.”

**Time:** 1:15 – 1:17 (2 min)

---

## Slide 15 — The vulnerable design

### gokul1630/root plugin

```java
// ExecuteCommand handler
String command = call.argument("cmd");  // ← untrusted
Shell.cmd(...).exec().getOut();
```

**Reference:** [github.com/gokul1630/root](https://github.com/gokul1630/root)

**Say:**
> “If Dart/JavaScript passes user input or MITM-controlled data into `cmd`, you get **arbitrary shell** on a rooted phone.”

**Time:** 1:17 – 1:22 (5 min)

---

## Slide 16 — libsu gotcha ( teach this! )

### Why our first script failed

| API | libsu 5.x |
|-----|-----------|
| `Shell.cmd(String)` | ❌ **Does not exist** |
| `Shell.cmd(String[])` | ✅ Use this |
| `Shell.cmd(InputStream)` | ✅ Exists — not our target |

**Fix:** `Java.array("java.lang.String", ["sh", "-c", "id"])`

**Say:**
> “Always check **overloads** in Frida errors. The message literally lists valid signatures.”

**Time:** 1:22 – 1:27 (5 min)

---

## Slide 17 — Mnemonic: J → S → H → R → RPC

| Step | Code idea |
|------|-----------|
| **J** | `Java.perform` |
| **S** | `Java.use("...Shell")` |
| **H** | Hook `Shell.cmd.overload("[Ljava.lang.String;")` |
| **R** | `Shell.cmd(["sh","-c",cmd]).exec()` |
| **RPC** | `rpc.exports.runCmd("id")` |

**Say:**
> “Five letters — write them on your cheat sheet. Everything in `guardianbank_cmd_injection.js` maps to one of these.”

**Time:** 1:27 – 1:30 (3 min)

---

## Slide 18 — Hook the sink (talk through code)

```javascript
var origCmd = Shell.cmd.overload("[Ljava.lang.String;");
Shell.cmd.overload("[Ljava.lang.String;").implementation = function (argv) {
    console.log("[CMD-INJ] " + argv);   // evidence
    return origCmd.call(this, argv);    // must call original
};
```

**Say:**
> “**Log + call original** = safe monitoring. **RPC runCmd** = active exploitation demo.”

**Time:** 1:30 – 1:35 (5 min)

---

## Slide 19 — LIVE DEMO: Command injection

### Run

```powershell
frida -U -f com.demo.guardianbank -l PPS_UAT\GuardianBank\guardianbank_cmd_injection.js
```

### In Frida REPL

```javascript
rpc.exports.runCmd("id")
rpc.exports.runCmd("cat /proc/version")
rpc.exports.runCmd("getprop ro.build.tags")
```

**Expected:** `uid=0(root)` on rooted AVD, `exit=0`  

**Screenshot for report:** Frida console showing command + output  

**Say:**
> “Point out: we didn’t exploit a server — we abused **embedded root shell** shipped inside the app’s dependency chain.”

**Time:** 1:35 – 1:50 (15 min) — *main hands-on block*

---

## Slide 20 — Optional combo demo

### Root bypass + cmd injection together

```powershell
frida -U -f com.demo.guardianbank `
  -l PPS_UAT\GuardianBank\guardianbank_root_bypass.js `
  -l PPS_UAT\GuardianBank\guardianbank_cmd_injection.js
```

**Say:**
> “Real assessments often chain findings: bypass client control → abuse dangerous API.”

**Time:** 1:50 – 1:55 (5 min)

---

## Slide 21 — Impact & CWE (reporting slide)

### Write this in your finding

| Field | Text |
|-------|------|
| **Title** | OS command injection via root plugin / libsu |
| **CWE** | CWE-78 (OS Command Injection) |
| **Impact** | Arbitrary command execution as root on compromised device |
| **Severity** | High (device-local), context-dependent in report |

**Say:**
> “Tie impact to **rooted device + malicious input path**. Not remote RCE on bank server unless you prove that chain.”

**Time:** 1:55 – 1:58 (3 min)

---

# BLOCK 6 — Insecure storage snapshot (10 min)

---

## Slide 22 — M6 in one slide

### Script 17 — no login required

```powershell
.\run_frida.ps1   → script 17
```

**Proves:**
- `shared_prefs` may be absent (Flutter storage elsewhere)  
- Clipboard holds OTP in cleartext  
- `demoClipboard()` auto PoC  

**Say:**
> “Storage testing is **evidence collection** — list dirs, hook clipboard, screenshot. Full steps in `WORKSHOP_CMD_INJECTION_EXPLAINED.md` companion and `PoC/M6/`.”

**Time:** 1:58 – 2:05 (7 min) — *optional quick demo if ahead of schedule; else skip*

---

## Slide 23 — Static code pointers (no live)

| File | Lines | Issue |
|------|-------|--------|
| `SignInHubActivity.java` | 178–181 | Auth state in plain `Bundle` |
| `InputConnectionAdaptor.java` | 95–112 | Clipboard read/write |

**Say:**
> “Static + dynamic together make a defensible report.”

**Time:** 2:05 – 2:08 (3 min)

---

# BLOCK 7 — Wrap-up (10 min)

---

## Slide 24 — What you learned today

### Takeaways

1. Mobile apps hide logic in **native/Flutter** layers — read plugins, not only `MainActivity`  
2. **Frida** proves bypasses and injection faster than static guesswork  
3. **Root plugins** that expose `ExecuteCommand` are a **command injection sink**  
4. Always match **Java overloads** (`String[]` vs `String`)  
5. Workshop artifacts: APK + 2 Frida scripts + line-by-line doc  

**Time:** 2:08 – 2:12 (4 min)

---

## Slide 25 — Cheat sheet (photo slide)

```
Spawn:  frida -U -f com.demo.guardianbank -l script.js
Java:   Java.perform → Java.use → .implementation
Root:   return false on isRooted / isRootAvailable
Cmd:    Shell.cmd(Java.array("java.lang.String", ["sh","-c", cmd])).exec()
REPL:   rpc.exports.runCmd("id")
```

**Time:** 2:12 – 2:15 (3 min)

---

## Slide 26 — Q&A + resources

### Files to keep

| File | Purpose |
|------|---------|
| `GuardianBank-workshop-debug.apk` | Lab app |
| `guardianbank_root_bypass.js` | Root bypass |
| `guardianbank_cmd_injection.js` | Command injection |
| `WORKSHOP_CMD_INJECTION_EXPLAINED.md` | Line-by-line notes |
| `WORKSHOP_2HR_TALKING_POINTS.md` | This deck |

**Say:**
> “Re-run the demos tonight once on your own emulator — muscle memory beats slides.”

**Time:** 2:15 – 2:20 (5 min buffer / Q&A)

---

## Facilitator notes (not on screen)

### Timing flex

- **Running late?** Shorten M6 (Slide 22) and static code (Slide 23).  
- **Running early?** Add Burp + TLS module teaser (5 min).  
- **Stuck on Frida error?** Read overload list aloud — fix `String[]` hook.  

### Common failures

| Symptom | Fix |
|---------|-----|
| Root bypass no effect | Use `-f` spawn, not attach |
| `cmd()` type error | Hook `[Ljava.lang.String;` |
| `runCmd` no root | Rooted AVD only |
| App ANR with many scripts | Load only 1–2 scripts |

### Pre-workshop (day before)

- [ ] Build/install APK on all student emulators  
- [ ] Test both scripts once  
- [ ] Share `WORKSHOP_CMD_INJECTION_EXPLAINED.md` as pre-read (optional)  

---

*End of deck — Mobile Banking VAPT Workshop (2 hours)*
