import { app, shell, safeStorage, BrowserWindow, dialog, BrowserView, ipcMain, clipboard } from "electron";
import { randomUUID, createHash } from "node:crypto";
import { promises, watch, existsSync } from "node:fs";
import os, { homedir, platform, totalmem, release, hostname } from "node:os";
import * as path from "node:path";
import path__default, { join } from "node:path";
import { pathToFileURL } from "node:url";
import { EventEmitter } from "node:events";
import simpleGit from "simple-git";
import initSqlJs from "sql.js";
import electronUpdater from "electron-updater";
import { fetch as fetch$1, Agent as Agent$1 } from "undici";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { spawn, execFile as execFile$1 } from "node:child_process";
import * as pty from "node-pty";
import { lookup as lookup$1 } from "node:dns/promises";
import { lookup } from "node:dns";
import { isIP } from "node:net";
import { createServer } from "node:http";
import { readdir, readFile, statfs, access } from "node:fs/promises";
import { promisify } from "node:util";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const is = {
  dev: !app.isPackaged
};
({
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
});
var re$1 = { exports: {} };
var constants$1;
var hasRequiredConstants$1;
function requireConstants$1() {
  if (hasRequiredConstants$1) return constants$1;
  hasRequiredConstants$1 = 1;
  const SEMVER_SPEC_VERSION = "2.0.0";
  const MAX_LENGTH = 256;
  const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
  9007199254740991;
  const MAX_SAFE_COMPONENT_LENGTH = 16;
  const MAX_SAFE_BUILD_LENGTH = MAX_LENGTH - 6;
  const RELEASE_TYPES = [
    "major",
    "premajor",
    "minor",
    "preminor",
    "patch",
    "prepatch",
    "prerelease"
  ];
  constants$1 = {
    MAX_LENGTH,
    MAX_SAFE_COMPONENT_LENGTH,
    MAX_SAFE_BUILD_LENGTH,
    MAX_SAFE_INTEGER,
    RELEASE_TYPES,
    SEMVER_SPEC_VERSION,
    FLAG_INCLUDE_PRERELEASE: 1,
    FLAG_LOOSE: 2
  };
  return constants$1;
}
var debug_1$1;
var hasRequiredDebug$1;
function requireDebug$1() {
  if (hasRequiredDebug$1) return debug_1$1;
  hasRequiredDebug$1 = 1;
  const debug = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {
  };
  debug_1$1 = debug;
  return debug_1$1;
}
var hasRequiredRe$1;
function requireRe$1() {
  if (hasRequiredRe$1) return re$1.exports;
  hasRequiredRe$1 = 1;
  (function(module, exports) {
    const {
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_LENGTH
    } = requireConstants$1();
    const debug = requireDebug$1();
    exports = module.exports = {};
    const re2 = exports.re = [];
    const safeRe = exports.safeRe = [];
    const src = exports.src = [];
    const safeSrc = exports.safeSrc = [];
    const t = exports.t = {};
    let R = 0;
    const LETTERDASHNUMBER = "[a-zA-Z0-9-]";
    const safeRegexReplacements = [
      ["\\s", 1],
      ["\\d", MAX_LENGTH],
      [LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
    ];
    const makeSafeRegex = (value) => {
      for (const [token, max] of safeRegexReplacements) {
        value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
      }
      return value;
    };
    const createToken = (name, value, isGlobal) => {
      const safe = makeSafeRegex(value);
      const index = R++;
      debug(name, index, value);
      t[name] = index;
      src[index] = value;
      safeSrc[index] = safe;
      re2[index] = new RegExp(value, isGlobal ? "g" : void 0);
      safeRe[index] = new RegExp(safe, isGlobal ? "g" : void 0);
    };
    createToken("NUMERICIDENTIFIER", "0|[1-9]\\d*");
    createToken("NUMERICIDENTIFIERLOOSE", "\\d+");
    createToken("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);
    createToken("MAINVERSION", `(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})`);
    createToken("MAINVERSIONLOOSE", `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASEIDENTIFIER", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIER]})`);
    createToken("PRERELEASEIDENTIFIERLOOSE", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASE", `(?:-(${src[t.PRERELEASEIDENTIFIER]}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);
    createToken("PRERELEASELOOSE", `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);
    createToken("BUILDIDENTIFIER", `${LETTERDASHNUMBER}+`);
    createToken("BUILD", `(?:\\+(${src[t.BUILDIDENTIFIER]}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);
    createToken("FULLPLAIN", `v?${src[t.MAINVERSION]}${src[t.PRERELEASE]}?${src[t.BUILD]}?`);
    createToken("FULL", `^${src[t.FULLPLAIN]}$`);
    createToken("LOOSEPLAIN", `[v=\\s]*${src[t.MAINVERSIONLOOSE]}${src[t.PRERELEASELOOSE]}?${src[t.BUILD]}?`);
    createToken("LOOSE", `^${src[t.LOOSEPLAIN]}$`);
    createToken("GTLT", "((?:<|>)?=?)");
    createToken("XRANGEIDENTIFIERLOOSE", `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
    createToken("XRANGEIDENTIFIER", `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);
    createToken("XRANGEPLAIN", `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:${src[t.PRERELEASE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGEPLAINLOOSE", `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:${src[t.PRERELEASELOOSE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
    createToken("XRANGELOOSE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COERCEPLAIN", `${"(^|[^\\d])(\\d{1,"}${MAX_SAFE_COMPONENT_LENGTH}})(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
    createToken("COERCE", `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
    createToken("COERCEFULL", src[t.COERCEPLAIN] + `(?:${src[t.PRERELEASE]})?(?:${src[t.BUILD]})?(?:$|[^\\d])`);
    createToken("COERCERTL", src[t.COERCE], true);
    createToken("COERCERTLFULL", src[t.COERCEFULL], true);
    createToken("LONETILDE", "(?:~>?)");
    createToken("TILDETRIM", `(\\s*)${src[t.LONETILDE]}\\s+`, true);
    exports.tildeTrimReplace = "$1~";
    createToken("TILDE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
    createToken("TILDELOOSE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("LONECARET", "(?:\\^)");
    createToken("CARETTRIM", `(\\s*)${src[t.LONECARET]}\\s+`, true);
    exports.caretTrimReplace = "$1^";
    createToken("CARET", `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
    createToken("CARETLOOSE", `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COMPARATORLOOSE", `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
    createToken("COMPARATOR", `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);
    createToken("COMPARATORTRIM", `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
    exports.comparatorTrimReplace = "$1$2$3";
    createToken("HYPHENRANGE", `^\\s*(${src[t.XRANGEPLAIN]})\\s+-\\s+(${src[t.XRANGEPLAIN]})\\s*$`);
    createToken("HYPHENRANGELOOSE", `^\\s*(${src[t.XRANGEPLAINLOOSE]})\\s+-\\s+(${src[t.XRANGEPLAINLOOSE]})\\s*$`);
    createToken("STAR", "(<|>)?=?\\s*\\*");
    createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
    createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
  })(re$1, re$1.exports);
  return re$1.exports;
}
var parseOptions_1$1;
var hasRequiredParseOptions$1;
function requireParseOptions$1() {
  if (hasRequiredParseOptions$1) return parseOptions_1$1;
  hasRequiredParseOptions$1 = 1;
  const looseOption = Object.freeze({ loose: true });
  const emptyOpts = Object.freeze({});
  const parseOptions = (options) => {
    if (!options) {
      return emptyOpts;
    }
    if (typeof options !== "object") {
      return looseOption;
    }
    return options;
  };
  parseOptions_1$1 = parseOptions;
  return parseOptions_1$1;
}
var identifiers$1;
var hasRequiredIdentifiers$1;
function requireIdentifiers$1() {
  if (hasRequiredIdentifiers$1) return identifiers$1;
  hasRequiredIdentifiers$1 = 1;
  const numeric = /^[0-9]+$/;
  const compareIdentifiers = (a, b) => {
    if (typeof a === "number" && typeof b === "number") {
      return a === b ? 0 : a < b ? -1 : 1;
    }
    const anum = numeric.test(a);
    const bnum = numeric.test(b);
    if (anum && bnum) {
      a = +a;
      b = +b;
    }
    return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
  };
  const rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);
  identifiers$1 = {
    compareIdentifiers,
    rcompareIdentifiers
  };
  return identifiers$1;
}
var semver$4;
var hasRequiredSemver$4;
function requireSemver$4() {
  if (hasRequiredSemver$4) return semver$4;
  hasRequiredSemver$4 = 1;
  const debug = requireDebug$1();
  const { MAX_LENGTH, MAX_SAFE_INTEGER } = requireConstants$1();
  const { safeRe: re2, t } = requireRe$1();
  const parseOptions = requireParseOptions$1();
  const { compareIdentifiers } = requireIdentifiers$1();
  const isPrereleaseIdentifier = (prerelease, identifier) => {
    const identifiers2 = identifier.split(".");
    if (identifiers2.length > prerelease.length) {
      return false;
    }
    for (let i = 0; i < identifiers2.length; i++) {
      if (compareIdentifiers(prerelease[i], identifiers2[i]) !== 0) {
        return false;
      }
    }
    return true;
  };
  class SemVer {
    constructor(version, options) {
      options = parseOptions(options);
      if (version instanceof SemVer) {
        if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) {
          return version;
        } else {
          version = version.version;
        }
      } else if (typeof version !== "string") {
        throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`);
      }
      if (version.length > MAX_LENGTH) {
        throw new TypeError(
          `version is longer than ${MAX_LENGTH} characters`
        );
      }
      debug("SemVer", version, options);
      this.options = options;
      this.loose = !!options.loose;
      this.includePrerelease = !!options.includePrerelease;
      const m = version.trim().match(options.loose ? re2[t.LOOSE] : re2[t.FULL]);
      if (!m) {
        throw new TypeError(`Invalid Version: ${version}`);
      }
      this.raw = version;
      this.major = +m[1];
      this.minor = +m[2];
      this.patch = +m[3];
      if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
        throw new TypeError("Invalid major version");
      }
      if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
        throw new TypeError("Invalid minor version");
      }
      if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
        throw new TypeError("Invalid patch version");
      }
      if (!m[4]) {
        this.prerelease = [];
      } else {
        this.prerelease = m[4].split(".").map((id2) => {
          if (/^[0-9]+$/.test(id2)) {
            const num = +id2;
            if (num >= 0 && num < MAX_SAFE_INTEGER) {
              return num;
            }
          }
          return id2;
        });
      }
      this.build = m[5] ? m[5].split(".") : [];
      this.format();
    }
    format() {
      this.version = `${this.major}.${this.minor}.${this.patch}`;
      if (this.prerelease.length) {
        this.version += `-${this.prerelease.join(".")}`;
      }
      return this.version;
    }
    toString() {
      return this.version;
    }
    compare(other) {
      debug("SemVer.compare", this.version, this.options, other);
      if (!(other instanceof SemVer)) {
        if (typeof other === "string" && other === this.version) {
          return 0;
        }
        other = new SemVer(other, this.options);
      }
      if (other.version === this.version) {
        return 0;
      }
      return this.compareMain(other) || this.comparePre(other);
    }
    compareMain(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      if (this.major < other.major) {
        return -1;
      }
      if (this.major > other.major) {
        return 1;
      }
      if (this.minor < other.minor) {
        return -1;
      }
      if (this.minor > other.minor) {
        return 1;
      }
      if (this.patch < other.patch) {
        return -1;
      }
      if (this.patch > other.patch) {
        return 1;
      }
      return 0;
    }
    comparePre(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      if (this.prerelease.length && !other.prerelease.length) {
        return -1;
      } else if (!this.prerelease.length && other.prerelease.length) {
        return 1;
      } else if (!this.prerelease.length && !other.prerelease.length) {
        return 0;
      }
      let i = 0;
      do {
        const a = this.prerelease[i];
        const b = other.prerelease[i];
        debug("prerelease compare", i, a, b);
        if (a === void 0 && b === void 0) {
          return 0;
        } else if (b === void 0) {
          return 1;
        } else if (a === void 0) {
          return -1;
        } else if (a === b) {
          continue;
        } else {
          return compareIdentifiers(a, b);
        }
      } while (++i);
    }
    compareBuild(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      let i = 0;
      do {
        const a = this.build[i];
        const b = other.build[i];
        debug("build compare", i, a, b);
        if (a === void 0 && b === void 0) {
          return 0;
        } else if (b === void 0) {
          return 1;
        } else if (a === void 0) {
          return -1;
        } else if (a === b) {
          continue;
        } else {
          return compareIdentifiers(a, b);
        }
      } while (++i);
    }
    // preminor will bump the version up to the next minor release, and immediately
    // down to pre-release. premajor and prepatch work the same way.
    inc(release2, identifier, identifierBase) {
      if (release2.startsWith("pre")) {
        if (!identifier && identifierBase === false) {
          throw new Error("invalid increment argument: identifier is empty");
        }
        if (identifier) {
          const match = `-${identifier}`.match(this.options.loose ? re2[t.PRERELEASELOOSE] : re2[t.PRERELEASE]);
          if (!match || match[1] !== identifier) {
            throw new Error(`invalid identifier: ${identifier}`);
          }
        }
      }
      switch (release2) {
        case "premajor":
          this.prerelease.length = 0;
          this.patch = 0;
          this.minor = 0;
          this.major++;
          this.inc("pre", identifier, identifierBase);
          break;
        case "preminor":
          this.prerelease.length = 0;
          this.patch = 0;
          this.minor++;
          this.inc("pre", identifier, identifierBase);
          break;
        case "prepatch":
          this.prerelease.length = 0;
          this.inc("patch", identifier, identifierBase);
          this.inc("pre", identifier, identifierBase);
          break;
        // If the input is a non-prerelease version, this acts the same as
        // prepatch.
        case "prerelease":
          if (this.prerelease.length === 0) {
            this.inc("patch", identifier, identifierBase);
          }
          this.inc("pre", identifier, identifierBase);
          break;
        case "release":
          if (this.prerelease.length === 0) {
            throw new Error(`version ${this.raw} is not a prerelease`);
          }
          this.prerelease.length = 0;
          break;
        case "major":
          if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
            this.major++;
          }
          this.minor = 0;
          this.patch = 0;
          this.prerelease = [];
          break;
        case "minor":
          if (this.patch !== 0 || this.prerelease.length === 0) {
            this.minor++;
          }
          this.patch = 0;
          this.prerelease = [];
          break;
        case "patch":
          if (this.prerelease.length === 0) {
            this.patch++;
          }
          this.prerelease = [];
          break;
        // This probably shouldn't be used publicly.
        // 1.0.0 'pre' would become 1.0.0-0 which is the wrong direction.
        case "pre": {
          const base = Number(identifierBase) ? 1 : 0;
          if (this.prerelease.length === 0) {
            this.prerelease = [base];
          } else {
            let i = this.prerelease.length;
            while (--i >= 0) {
              if (typeof this.prerelease[i] === "number") {
                this.prerelease[i]++;
                i = -2;
              }
            }
            if (i === -1) {
              if (identifier === this.prerelease.join(".") && identifierBase === false) {
                throw new Error("invalid increment argument: identifier already exists");
              }
              this.prerelease.push(base);
            }
          }
          if (identifier) {
            let prerelease = [identifier, base];
            if (identifierBase === false) {
              prerelease = [identifier];
            }
            if (isPrereleaseIdentifier(this.prerelease, identifier)) {
              const prereleaseBase = this.prerelease[identifier.split(".").length];
              if (isNaN(prereleaseBase)) {
                this.prerelease = prerelease;
              }
            } else {
              this.prerelease = prerelease;
            }
          }
          break;
        }
        default:
          throw new Error(`invalid increment argument: ${release2}`);
      }
      this.raw = this.format();
      if (this.build.length) {
        this.raw += `+${this.build.join(".")}`;
      }
      return this;
    }
  }
  semver$4 = SemVer;
  return semver$4;
}
var parse_1$1;
var hasRequiredParse$1;
function requireParse$1() {
  if (hasRequiredParse$1) return parse_1$1;
  hasRequiredParse$1 = 1;
  const SemVer = requireSemver$4();
  const parse = (version, options, throwErrors = false) => {
    if (version instanceof SemVer) {
      return version;
    }
    try {
      return new SemVer(version, options);
    } catch (er) {
      if (!throwErrors) {
        return null;
      }
      throw er;
    }
  };
  parse_1$1 = parse;
  return parse_1$1;
}
var valid_1$1;
var hasRequiredValid$3;
function requireValid$3() {
  if (hasRequiredValid$3) return valid_1$1;
  hasRequiredValid$3 = 1;
  const parse = requireParse$1();
  const valid2 = (version, options) => {
    const v = parse(version, options);
    return v ? v.version : null;
  };
  valid_1$1 = valid2;
  return valid_1$1;
}
var clean_1$1;
var hasRequiredClean$1;
function requireClean$1() {
  if (hasRequiredClean$1) return clean_1$1;
  hasRequiredClean$1 = 1;
  const parse = requireParse$1();
  const clean = (version, options) => {
    const s = parse(version.trim().replace(/^[=v]+/, ""), options);
    return s ? s.version : null;
  };
  clean_1$1 = clean;
  return clean_1$1;
}
var inc_1$1;
var hasRequiredInc$1;
function requireInc$1() {
  if (hasRequiredInc$1) return inc_1$1;
  hasRequiredInc$1 = 1;
  const SemVer = requireSemver$4();
  const inc = (version, release2, options, identifier, identifierBase) => {
    if (typeof options === "string") {
      identifierBase = identifier;
      identifier = options;
      options = void 0;
    }
    try {
      return new SemVer(
        version instanceof SemVer ? version.version : version,
        options
      ).inc(release2, identifier, identifierBase).version;
    } catch (er) {
      return null;
    }
  };
  inc_1$1 = inc;
  return inc_1$1;
}
var diff_1$1;
var hasRequiredDiff$1;
function requireDiff$1() {
  if (hasRequiredDiff$1) return diff_1$1;
  hasRequiredDiff$1 = 1;
  const parse = requireParse$1();
  const diff = (version1, version2) => {
    const v1 = parse(version1, null, true);
    const v2 = parse(version2, null, true);
    const comparison = v1.compare(v2);
    if (comparison === 0) {
      return null;
    }
    const v1Higher = comparison > 0;
    const highVersion = v1Higher ? v1 : v2;
    const lowVersion = v1Higher ? v2 : v1;
    const highHasPre = !!highVersion.prerelease.length;
    const lowHasPre = !!lowVersion.prerelease.length;
    if (lowHasPre && !highHasPre) {
      if (!lowVersion.patch && !lowVersion.minor) {
        return "major";
      }
      if (lowVersion.compareMain(highVersion) === 0) {
        if (lowVersion.minor && !lowVersion.patch) {
          return "minor";
        }
        return "patch";
      }
    }
    const prefix = highHasPre ? "pre" : "";
    if (v1.major !== v2.major) {
      return prefix + "major";
    }
    if (v1.minor !== v2.minor) {
      return prefix + "minor";
    }
    if (v1.patch !== v2.patch) {
      return prefix + "patch";
    }
    return "prerelease";
  };
  diff_1$1 = diff;
  return diff_1$1;
}
var major_1$1;
var hasRequiredMajor$1;
function requireMajor$1() {
  if (hasRequiredMajor$1) return major_1$1;
  hasRequiredMajor$1 = 1;
  const SemVer = requireSemver$4();
  const major = (a, loose) => new SemVer(a, loose).major;
  major_1$1 = major;
  return major_1$1;
}
var minor_1$1;
var hasRequiredMinor$1;
function requireMinor$1() {
  if (hasRequiredMinor$1) return minor_1$1;
  hasRequiredMinor$1 = 1;
  const SemVer = requireSemver$4();
  const minor = (a, loose) => new SemVer(a, loose).minor;
  minor_1$1 = minor;
  return minor_1$1;
}
var patch_1$1;
var hasRequiredPatch$1;
function requirePatch$1() {
  if (hasRequiredPatch$1) return patch_1$1;
  hasRequiredPatch$1 = 1;
  const SemVer = requireSemver$4();
  const patch = (a, loose) => new SemVer(a, loose).patch;
  patch_1$1 = patch;
  return patch_1$1;
}
var prerelease_1$1;
var hasRequiredPrerelease$1;
function requirePrerelease$1() {
  if (hasRequiredPrerelease$1) return prerelease_1$1;
  hasRequiredPrerelease$1 = 1;
  const parse = requireParse$1();
  const prerelease = (version, options) => {
    const parsed = parse(version, options);
    return parsed && parsed.prerelease.length ? parsed.prerelease : null;
  };
  prerelease_1$1 = prerelease;
  return prerelease_1$1;
}
var compare_1$1;
var hasRequiredCompare$1;
function requireCompare$1() {
  if (hasRequiredCompare$1) return compare_1$1;
  hasRequiredCompare$1 = 1;
  const SemVer = requireSemver$4();
  const compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
  compare_1$1 = compare;
  return compare_1$1;
}
var rcompare_1$1;
var hasRequiredRcompare$1;
function requireRcompare$1() {
  if (hasRequiredRcompare$1) return rcompare_1$1;
  hasRequiredRcompare$1 = 1;
  const compare = requireCompare$1();
  const rcompare = (a, b, loose) => compare(b, a, loose);
  rcompare_1$1 = rcompare;
  return rcompare_1$1;
}
var compareLoose_1$1;
var hasRequiredCompareLoose$1;
function requireCompareLoose$1() {
  if (hasRequiredCompareLoose$1) return compareLoose_1$1;
  hasRequiredCompareLoose$1 = 1;
  const compare = requireCompare$1();
  const compareLoose = (a, b) => compare(a, b, true);
  compareLoose_1$1 = compareLoose;
  return compareLoose_1$1;
}
var compareBuild_1$1;
var hasRequiredCompareBuild$1;
function requireCompareBuild$1() {
  if (hasRequiredCompareBuild$1) return compareBuild_1$1;
  hasRequiredCompareBuild$1 = 1;
  const SemVer = requireSemver$4();
  const compareBuild = (a, b, loose) => {
    const versionA = new SemVer(a, loose);
    const versionB = new SemVer(b, loose);
    return versionA.compare(versionB) || versionA.compareBuild(versionB);
  };
  compareBuild_1$1 = compareBuild;
  return compareBuild_1$1;
}
var sort_1$1;
var hasRequiredSort$1;
function requireSort$1() {
  if (hasRequiredSort$1) return sort_1$1;
  hasRequiredSort$1 = 1;
  const compareBuild = requireCompareBuild$1();
  const sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
  sort_1$1 = sort;
  return sort_1$1;
}
var rsort_1$1;
var hasRequiredRsort$1;
function requireRsort$1() {
  if (hasRequiredRsort$1) return rsort_1$1;
  hasRequiredRsort$1 = 1;
  const compareBuild = requireCompareBuild$1();
  const rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
  rsort_1$1 = rsort;
  return rsort_1$1;
}
var gt_1$1;
var hasRequiredGt$1;
function requireGt$1() {
  if (hasRequiredGt$1) return gt_1$1;
  hasRequiredGt$1 = 1;
  const compare = requireCompare$1();
  const gt = (a, b, loose) => compare(a, b, loose) > 0;
  gt_1$1 = gt;
  return gt_1$1;
}
var lt_1$1;
var hasRequiredLt$1;
function requireLt$1() {
  if (hasRequiredLt$1) return lt_1$1;
  hasRequiredLt$1 = 1;
  const compare = requireCompare$1();
  const lt = (a, b, loose) => compare(a, b, loose) < 0;
  lt_1$1 = lt;
  return lt_1$1;
}
var eq_1$1;
var hasRequiredEq$1;
function requireEq$1() {
  if (hasRequiredEq$1) return eq_1$1;
  hasRequiredEq$1 = 1;
  const compare = requireCompare$1();
  const eq = (a, b, loose) => compare(a, b, loose) === 0;
  eq_1$1 = eq;
  return eq_1$1;
}
var neq_1$1;
var hasRequiredNeq$1;
function requireNeq$1() {
  if (hasRequiredNeq$1) return neq_1$1;
  hasRequiredNeq$1 = 1;
  const compare = requireCompare$1();
  const neq = (a, b, loose) => compare(a, b, loose) !== 0;
  neq_1$1 = neq;
  return neq_1$1;
}
var gte_1$1;
var hasRequiredGte$1;
function requireGte$1() {
  if (hasRequiredGte$1) return gte_1$1;
  hasRequiredGte$1 = 1;
  const compare = requireCompare$1();
  const gte = (a, b, loose) => compare(a, b, loose) >= 0;
  gte_1$1 = gte;
  return gte_1$1;
}
var lte_1$1;
var hasRequiredLte$1;
function requireLte$1() {
  if (hasRequiredLte$1) return lte_1$1;
  hasRequiredLte$1 = 1;
  const compare = requireCompare$1();
  const lte = (a, b, loose) => compare(a, b, loose) <= 0;
  lte_1$1 = lte;
  return lte_1$1;
}
var cmp_1$1;
var hasRequiredCmp$1;
function requireCmp$1() {
  if (hasRequiredCmp$1) return cmp_1$1;
  hasRequiredCmp$1 = 1;
  const eq = requireEq$1();
  const neq = requireNeq$1();
  const gt = requireGt$1();
  const gte = requireGte$1();
  const lt = requireLt$1();
  const lte = requireLte$1();
  const cmp = (a, op, b, loose) => {
    switch (op) {
      case "===":
        if (typeof a === "object") {
          a = a.version;
        }
        if (typeof b === "object") {
          b = b.version;
        }
        return a === b;
      case "!==":
        if (typeof a === "object") {
          a = a.version;
        }
        if (typeof b === "object") {
          b = b.version;
        }
        return a !== b;
      case "":
      case "=":
      case "==":
        return eq(a, b, loose);
      case "!=":
        return neq(a, b, loose);
      case ">":
        return gt(a, b, loose);
      case ">=":
        return gte(a, b, loose);
      case "<":
        return lt(a, b, loose);
      case "<=":
        return lte(a, b, loose);
      default:
        throw new TypeError(`Invalid operator: ${op}`);
    }
  };
  cmp_1$1 = cmp;
  return cmp_1$1;
}
var coerce_1$1;
var hasRequiredCoerce$1;
function requireCoerce$1() {
  if (hasRequiredCoerce$1) return coerce_1$1;
  hasRequiredCoerce$1 = 1;
  const SemVer = requireSemver$4();
  const parse = requireParse$1();
  const { safeRe: re2, t } = requireRe$1();
  const coerce = (version, options) => {
    if (version instanceof SemVer) {
      return version;
    }
    if (typeof version === "number") {
      version = String(version);
    }
    if (typeof version !== "string") {
      return null;
    }
    options = options || {};
    let match = null;
    if (!options.rtl) {
      match = version.match(options.includePrerelease ? re2[t.COERCEFULL] : re2[t.COERCE]);
    } else {
      const coerceRtlRegex = options.includePrerelease ? re2[t.COERCERTLFULL] : re2[t.COERCERTL];
      let next;
      while ((next = coerceRtlRegex.exec(version)) && (!match || match.index + match[0].length !== version.length)) {
        if (!match || next.index + next[0].length !== match.index + match[0].length) {
          match = next;
        }
        coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
      }
      coerceRtlRegex.lastIndex = -1;
    }
    if (match === null) {
      return null;
    }
    const major = match[2];
    const minor = match[3] || "0";
    const patch = match[4] || "0";
    const prerelease = options.includePrerelease && match[5] ? `-${match[5]}` : "";
    const build = options.includePrerelease && match[6] ? `+${match[6]}` : "";
    return parse(`${major}.${minor}.${patch}${prerelease}${build}`, options);
  };
  coerce_1$1 = coerce;
  return coerce_1$1;
}
var truncate_1$1;
var hasRequiredTruncate$1;
function requireTruncate$1() {
  if (hasRequiredTruncate$1) return truncate_1$1;
  hasRequiredTruncate$1 = 1;
  const parse = requireParse$1();
  const constants2 = requireConstants$1();
  const SemVer = requireSemver$4();
  const truncate = (version, truncation, options) => {
    if (!constants2.RELEASE_TYPES.includes(truncation)) {
      return null;
    }
    const clonedVersion = cloneInputVersion(version, options);
    return clonedVersion && doTruncation(clonedVersion, truncation);
  };
  const cloneInputVersion = (version, options) => {
    const versionStringToParse = version instanceof SemVer ? version.version : version;
    return parse(versionStringToParse, options);
  };
  const doTruncation = (version, truncation) => {
    if (isPrerelease(truncation)) {
      return version.version;
    }
    version.prerelease = [];
    switch (truncation) {
      case "major":
        version.minor = 0;
        version.patch = 0;
        break;
      case "minor":
        version.patch = 0;
        break;
    }
    return version.format();
  };
  const isPrerelease = (type) => {
    return type.startsWith("pre");
  };
  truncate_1$1 = truncate;
  return truncate_1$1;
}
var lrucache$1;
var hasRequiredLrucache$1;
function requireLrucache$1() {
  if (hasRequiredLrucache$1) return lrucache$1;
  hasRequiredLrucache$1 = 1;
  class LRUCache {
    constructor() {
      this.max = 1e3;
      this.map = /* @__PURE__ */ new Map();
    }
    get(key) {
      const value = this.map.get(key);
      if (value === void 0) {
        return void 0;
      } else {
        this.map.delete(key);
        this.map.set(key, value);
        return value;
      }
    }
    delete(key) {
      return this.map.delete(key);
    }
    set(key, value) {
      const deleted = this.delete(key);
      if (!deleted && value !== void 0) {
        if (this.map.size >= this.max) {
          const firstKey = this.map.keys().next().value;
          this.delete(firstKey);
        }
        this.map.set(key, value);
      }
      return this;
    }
  }
  lrucache$1 = LRUCache;
  return lrucache$1;
}
var range$1;
var hasRequiredRange$1;
function requireRange$1() {
  if (hasRequiredRange$1) return range$1;
  hasRequiredRange$1 = 1;
  const SPACE_CHARACTERS = /\s+/g;
  class Range {
    constructor(range2, options) {
      options = parseOptions(options);
      if (range2 instanceof Range) {
        if (range2.loose === !!options.loose && range2.includePrerelease === !!options.includePrerelease) {
          return range2;
        } else {
          return new Range(range2.raw, options);
        }
      }
      if (range2 instanceof Comparator) {
        this.raw = range2.value;
        this.set = [[range2]];
        this.formatted = void 0;
        return this;
      }
      this.options = options;
      this.loose = !!options.loose;
      this.includePrerelease = !!options.includePrerelease;
      this.raw = range2.trim().replace(SPACE_CHARACTERS, " ");
      this.set = this.raw.split("||").map((r) => this.parseRange(r.trim())).filter((c) => c.length);
      if (!this.set.length) {
        throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
      }
      if (this.set.length > 1) {
        const first = this.set[0];
        this.set = this.set.filter((c) => !isNullSet(c[0]));
        if (this.set.length === 0) {
          this.set = [first];
        } else if (this.set.length > 1) {
          for (const c of this.set) {
            if (c.length === 1 && isAny(c[0])) {
              this.set = [c];
              break;
            }
          }
        }
      }
      this.formatted = void 0;
    }
    get range() {
      if (this.formatted === void 0) {
        this.formatted = "";
        for (let i = 0; i < this.set.length; i++) {
          if (i > 0) {
            this.formatted += "||";
          }
          const comps = this.set[i];
          for (let k = 0; k < comps.length; k++) {
            if (k > 0) {
              this.formatted += " ";
            }
            this.formatted += comps[k].toString().trim();
          }
        }
      }
      return this.formatted;
    }
    format() {
      return this.range;
    }
    toString() {
      return this.range;
    }
    parseRange(range2) {
      range2 = range2.replace(BUILDSTRIPRE, "");
      const memoOpts = (this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE);
      const memoKey = memoOpts + ":" + range2;
      const cached = cache.get(memoKey);
      if (cached) {
        return cached;
      }
      const loose = this.options.loose;
      const hr = loose ? re2[t.HYPHENRANGELOOSE] : re2[t.HYPHENRANGE];
      range2 = range2.replace(hr, hyphenReplace(this.options.includePrerelease));
      debug("hyphen replace", range2);
      range2 = range2.replace(re2[t.COMPARATORTRIM], comparatorTrimReplace);
      debug("comparator trim", range2);
      range2 = range2.replace(re2[t.TILDETRIM], tildeTrimReplace);
      debug("tilde trim", range2);
      range2 = range2.replace(re2[t.CARETTRIM], caretTrimReplace);
      debug("caret trim", range2);
      let rangeList = range2.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
      if (loose) {
        rangeList = rangeList.filter((comp) => {
          debug("loose invalid filter", comp, this.options);
          return !!comp.match(re2[t.COMPARATORLOOSE]);
        });
      }
      debug("range list", rangeList);
      const rangeMap = /* @__PURE__ */ new Map();
      const comparators = rangeList.map((comp) => new Comparator(comp, this.options));
      for (const comp of comparators) {
        if (isNullSet(comp)) {
          return [comp];
        }
        rangeMap.set(comp.value, comp);
      }
      if (rangeMap.size > 1 && rangeMap.has("")) {
        rangeMap.delete("");
      }
      const result = [...rangeMap.values()];
      cache.set(memoKey, result);
      return result;
    }
    intersects(range2, options) {
      if (!(range2 instanceof Range)) {
        throw new TypeError("a Range is required");
      }
      return this.set.some((thisComparators) => {
        return isSatisfiable(thisComparators, options) && range2.set.some((rangeComparators) => {
          return isSatisfiable(rangeComparators, options) && thisComparators.every((thisComparator) => {
            return rangeComparators.every((rangeComparator) => {
              return thisComparator.intersects(rangeComparator, options);
            });
          });
        });
      });
    }
    // if ANY of the sets match ALL of its comparators, then pass
    test(version) {
      if (!version) {
        return false;
      }
      if (typeof version === "string") {
        try {
          version = new SemVer(version, this.options);
        } catch (er) {
          return false;
        }
      }
      for (let i = 0; i < this.set.length; i++) {
        if (testSet(this.set[i], version, this.options)) {
          return true;
        }
      }
      return false;
    }
  }
  range$1 = Range;
  const LRU = requireLrucache$1();
  const cache = new LRU();
  const parseOptions = requireParseOptions$1();
  const Comparator = requireComparator$1();
  const debug = requireDebug$1();
  const SemVer = requireSemver$4();
  const {
    safeRe: re2,
    src,
    t,
    comparatorTrimReplace,
    tildeTrimReplace,
    caretTrimReplace
  } = requireRe$1();
  const { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = requireConstants$1();
  const BUILDSTRIPRE = new RegExp(src[t.BUILD], "g");
  const isNullSet = (c) => c.value === "<0.0.0-0";
  const isAny = (c) => c.value === "";
  const isSatisfiable = (comparators, options) => {
    let result = true;
    const remainingComparators = comparators.slice();
    let testComparator = remainingComparators.pop();
    while (result && remainingComparators.length) {
      result = remainingComparators.every((otherComparator) => {
        return testComparator.intersects(otherComparator, options);
      });
      testComparator = remainingComparators.pop();
    }
    return result;
  };
  const parseComparator = (comp, options) => {
    comp = comp.replace(re2[t.BUILD], "");
    debug("comp", comp, options);
    comp = replaceCarets(comp, options);
    debug("caret", comp);
    comp = replaceTildes(comp, options);
    debug("tildes", comp);
    comp = replaceXRanges(comp, options);
    debug("xrange", comp);
    comp = replaceStars(comp, options);
    debug("stars", comp);
    return comp;
  };
  const isX = (id2) => !id2 || id2.toLowerCase() === "x" || id2 === "*";
  const invalidXRangeOrder = (M, m, p) => isX(M) && !isX(m) || isX(m) && p && !isX(p);
  const replaceTildes = (comp, options) => {
    return comp.trim().split(/\s+/).map((c) => replaceTilde(c, options)).join(" ");
  };
  const replaceTilde = (comp, options) => {
    const r = options.loose ? re2[t.TILDELOOSE] : re2[t.TILDE];
    const z2 = options.includePrerelease ? "-0" : "";
    return comp.replace(r, (_, M, m, p, pr) => {
      debug("tilde", comp, _, M, m, p, pr);
      let ret;
      if (isX(M)) {
        ret = "";
      } else if (isX(m)) {
        ret = `>=${M}.0.0${z2} <${+M + 1}.0.0-0`;
      } else if (isX(p)) {
        ret = `>=${M}.${m}.0${z2} <${M}.${+m + 1}.0-0`;
      } else if (pr) {
        debug("replaceTilde pr", pr);
        ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
      } else {
        ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
      }
      debug("tilde return", ret);
      return ret;
    });
  };
  const replaceCarets = (comp, options) => {
    return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
  };
  const replaceCaret = (comp, options) => {
    debug("caret", comp, options);
    const r = options.loose ? re2[t.CARETLOOSE] : re2[t.CARET];
    const z2 = options.includePrerelease ? "-0" : "";
    return comp.replace(r, (_, M, m, p, pr) => {
      debug("caret", comp, _, M, m, p, pr);
      let ret;
      if (isX(M)) {
        ret = "";
      } else if (isX(m)) {
        ret = `>=${M}.0.0${z2} <${+M + 1}.0.0-0`;
      } else if (isX(p)) {
        if (M === "0") {
          ret = `>=${M}.${m}.0${z2} <${M}.${+m + 1}.0-0`;
        } else {
          ret = `>=${M}.${m}.0${z2} <${+M + 1}.0.0-0`;
        }
      } else if (pr) {
        debug("replaceCaret pr", pr);
        if (M === "0") {
          if (m === "0") {
            ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
          } else {
            ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
          }
        } else {
          ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
        }
      } else {
        debug("no pr");
        if (M === "0") {
          if (m === "0") {
            ret = `>=${M}.${m}.${p} <${M}.${m}.${+p + 1}-0`;
          } else {
            ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
          }
        } else {
          ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
        }
      }
      debug("caret return", ret);
      return ret;
    });
  };
  const replaceXRanges = (comp, options) => {
    debug("replaceXRanges", comp, options);
    return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
  };
  const replaceXRange = (comp, options) => {
    comp = comp.trim();
    const r = options.loose ? re2[t.XRANGELOOSE] : re2[t.XRANGE];
    return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
      debug("xRange", comp, ret, gtlt, M, m, p, pr);
      if (invalidXRangeOrder(M, m, p)) {
        return comp;
      }
      const xM = isX(M);
      const xm = xM || isX(m);
      const xp = xm || isX(p);
      const anyX = xp;
      if (gtlt === "=" && anyX) {
        gtlt = "";
      }
      pr = options.includePrerelease ? "-0" : "";
      if (xM) {
        if (gtlt === ">" || gtlt === "<") {
          ret = "<0.0.0-0";
        } else {
          ret = "*";
        }
      } else if (gtlt && anyX) {
        if (xm) {
          m = 0;
        }
        p = 0;
        if (gtlt === ">") {
          gtlt = ">=";
          if (xm) {
            M = +M + 1;
            m = 0;
            p = 0;
          } else {
            m = +m + 1;
            p = 0;
          }
        } else if (gtlt === "<=") {
          gtlt = "<";
          if (xm) {
            M = +M + 1;
          } else {
            m = +m + 1;
          }
        }
        if (gtlt === "<") {
          pr = "-0";
        }
        ret = `${gtlt + M}.${m}.${p}${pr}`;
      } else if (xm) {
        ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
      } else if (xp) {
        ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
      }
      debug("xRange return", ret);
      return ret;
    });
  };
  const replaceStars = (comp, options) => {
    debug("replaceStars", comp, options);
    return comp.trim().replace(re2[t.STAR], "");
  };
  const replaceGTE0 = (comp, options) => {
    debug("replaceGTE0", comp, options);
    return comp.trim().replace(re2[options.includePrerelease ? t.GTE0PRE : t.GTE0], "");
  };
  const hyphenReplace = (incPr) => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
    if (isX(fM)) {
      from = "";
    } else if (isX(fm)) {
      from = `>=${fM}.0.0${incPr ? "-0" : ""}`;
    } else if (isX(fp)) {
      from = `>=${fM}.${fm}.0${incPr ? "-0" : ""}`;
    } else if (fpr) {
      from = `>=${from}`;
    } else {
      from = `>=${from}${incPr ? "-0" : ""}`;
    }
    if (isX(tM)) {
      to = "";
    } else if (isX(tm)) {
      to = `<${+tM + 1}.0.0-0`;
    } else if (isX(tp)) {
      to = `<${tM}.${+tm + 1}.0-0`;
    } else if (tpr) {
      to = `<=${tM}.${tm}.${tp}-${tpr}`;
    } else if (incPr) {
      to = `<${tM}.${tm}.${+tp + 1}-0`;
    } else {
      to = `<=${to}`;
    }
    return `${from} ${to}`.trim();
  };
  const testSet = (set, version, options) => {
    for (let i = 0; i < set.length; i++) {
      if (!set[i].test(version)) {
        return false;
      }
    }
    if (version.prerelease.length && !options.includePrerelease) {
      for (let i = 0; i < set.length; i++) {
        debug(set[i].semver);
        if (set[i].semver === Comparator.ANY) {
          continue;
        }
        if (set[i].semver.prerelease.length > 0) {
          const allowed = set[i].semver;
          if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) {
            return true;
          }
        }
      }
      return false;
    }
    return true;
  };
  return range$1;
}
var comparator$1;
var hasRequiredComparator$1;
function requireComparator$1() {
  if (hasRequiredComparator$1) return comparator$1;
  hasRequiredComparator$1 = 1;
  const ANY = Symbol("SemVer ANY");
  class Comparator {
    static get ANY() {
      return ANY;
    }
    constructor(comp, options) {
      options = parseOptions(options);
      if (comp instanceof Comparator) {
        if (comp.loose === !!options.loose) {
          return comp;
        } else {
          comp = comp.value;
        }
      }
      comp = comp.trim().split(/\s+/).join(" ");
      debug("comparator", comp, options);
      this.options = options;
      this.loose = !!options.loose;
      this.parse(comp);
      if (this.semver === ANY) {
        this.value = "";
      } else {
        this.value = this.operator + this.semver.version;
      }
      debug("comp", this);
    }
    parse(comp) {
      const r = this.options.loose ? re2[t.COMPARATORLOOSE] : re2[t.COMPARATOR];
      const m = comp.match(r);
      if (!m) {
        throw new TypeError(`Invalid comparator: ${comp}`);
      }
      this.operator = m[1] !== void 0 ? m[1] : "";
      if (this.operator === "=") {
        this.operator = "";
      }
      if (!m[2]) {
        this.semver = ANY;
      } else {
        this.semver = new SemVer(m[2], this.options.loose);
      }
    }
    toString() {
      return this.value;
    }
    test(version) {
      debug("Comparator.test", version, this.options.loose);
      if (this.semver === ANY || version === ANY) {
        return true;
      }
      if (typeof version === "string") {
        try {
          version = new SemVer(version, this.options);
        } catch (er) {
          return false;
        }
      }
      return cmp(version, this.operator, this.semver, this.options);
    }
    intersects(comp, options) {
      if (!(comp instanceof Comparator)) {
        throw new TypeError("a Comparator is required");
      }
      if (this.operator === "") {
        if (this.value === "") {
          return true;
        }
        return new Range(comp.value, options).test(this.value);
      } else if (comp.operator === "") {
        if (comp.value === "") {
          return true;
        }
        return new Range(this.value, options).test(comp.semver);
      }
      options = parseOptions(options);
      if (options.includePrerelease && (this.value === "<0.0.0-0" || comp.value === "<0.0.0-0")) {
        return false;
      }
      if (!options.includePrerelease && (this.value.startsWith("<0.0.0") || comp.value.startsWith("<0.0.0"))) {
        return false;
      }
      if (this.operator.startsWith(">") && comp.operator.startsWith(">")) {
        return true;
      }
      if (this.operator.startsWith("<") && comp.operator.startsWith("<")) {
        return true;
      }
      if (this.semver.version === comp.semver.version && this.operator.includes("=") && comp.operator.includes("=")) {
        return true;
      }
      if (cmp(this.semver, "<", comp.semver, options) && this.operator.startsWith(">") && comp.operator.startsWith("<")) {
        return true;
      }
      if (cmp(this.semver, ">", comp.semver, options) && this.operator.startsWith("<") && comp.operator.startsWith(">")) {
        return true;
      }
      return false;
    }
  }
  comparator$1 = Comparator;
  const parseOptions = requireParseOptions$1();
  const { safeRe: re2, t } = requireRe$1();
  const cmp = requireCmp$1();
  const debug = requireDebug$1();
  const SemVer = requireSemver$4();
  const Range = requireRange$1();
  return comparator$1;
}
var satisfies_1$1;
var hasRequiredSatisfies$1;
function requireSatisfies$1() {
  if (hasRequiredSatisfies$1) return satisfies_1$1;
  hasRequiredSatisfies$1 = 1;
  const Range = requireRange$1();
  const satisfies = (version, range2, options) => {
    try {
      range2 = new Range(range2, options);
    } catch (er) {
      return false;
    }
    return range2.test(version);
  };
  satisfies_1$1 = satisfies;
  return satisfies_1$1;
}
var toComparators_1$1;
var hasRequiredToComparators$1;
function requireToComparators$1() {
  if (hasRequiredToComparators$1) return toComparators_1$1;
  hasRequiredToComparators$1 = 1;
  const Range = requireRange$1();
  const toComparators = (range2, options) => new Range(range2, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
  toComparators_1$1 = toComparators;
  return toComparators_1$1;
}
var maxSatisfying_1$1;
var hasRequiredMaxSatisfying$1;
function requireMaxSatisfying$1() {
  if (hasRequiredMaxSatisfying$1) return maxSatisfying_1$1;
  hasRequiredMaxSatisfying$1 = 1;
  const SemVer = requireSemver$4();
  const Range = requireRange$1();
  const maxSatisfying = (versions, range2, options) => {
    let max = null;
    let maxSV = null;
    let rangeObj = null;
    try {
      rangeObj = new Range(range2, options);
    } catch (er) {
      return null;
    }
    versions.forEach((v) => {
      if (rangeObj.test(v)) {
        if (!max || maxSV.compare(v) === -1) {
          max = v;
          maxSV = new SemVer(max, options);
        }
      }
    });
    return max;
  };
  maxSatisfying_1$1 = maxSatisfying;
  return maxSatisfying_1$1;
}
var minSatisfying_1$1;
var hasRequiredMinSatisfying$1;
function requireMinSatisfying$1() {
  if (hasRequiredMinSatisfying$1) return minSatisfying_1$1;
  hasRequiredMinSatisfying$1 = 1;
  const SemVer = requireSemver$4();
  const Range = requireRange$1();
  const minSatisfying = (versions, range2, options) => {
    let min = null;
    let minSV = null;
    let rangeObj = null;
    try {
      rangeObj = new Range(range2, options);
    } catch (er) {
      return null;
    }
    versions.forEach((v) => {
      if (rangeObj.test(v)) {
        if (!min || minSV.compare(v) === 1) {
          min = v;
          minSV = new SemVer(min, options);
        }
      }
    });
    return min;
  };
  minSatisfying_1$1 = minSatisfying;
  return minSatisfying_1$1;
}
var minVersion_1$1;
var hasRequiredMinVersion$1;
function requireMinVersion$1() {
  if (hasRequiredMinVersion$1) return minVersion_1$1;
  hasRequiredMinVersion$1 = 1;
  const SemVer = requireSemver$4();
  const Range = requireRange$1();
  const gt = requireGt$1();
  const minVersion = (range2, loose) => {
    range2 = new Range(range2, loose);
    let minver = new SemVer("0.0.0");
    if (range2.test(minver)) {
      return minver;
    }
    minver = new SemVer("0.0.0-0");
    if (range2.test(minver)) {
      return minver;
    }
    minver = null;
    for (let i = 0; i < range2.set.length; ++i) {
      const comparators = range2.set[i];
      let setMin = null;
      comparators.forEach((comparator2) => {
        const compver = new SemVer(comparator2.semver.version);
        switch (comparator2.operator) {
          case ">":
            if (compver.prerelease.length === 0) {
              compver.patch++;
            } else {
              compver.prerelease.push(0);
            }
            compver.raw = compver.format();
          /* fallthrough */
          case "":
          case ">=":
            if (!setMin || gt(compver, setMin)) {
              setMin = compver;
            }
            break;
          case "<":
          case "<=":
            break;
          /* istanbul ignore next */
          default:
            throw new Error(`Unexpected operation: ${comparator2.operator}`);
        }
      });
      if (setMin && (!minver || gt(minver, setMin))) {
        minver = setMin;
      }
    }
    if (minver && range2.test(minver)) {
      return minver;
    }
    return null;
  };
  minVersion_1$1 = minVersion;
  return minVersion_1$1;
}
var valid$1;
var hasRequiredValid$2;
function requireValid$2() {
  if (hasRequiredValid$2) return valid$1;
  hasRequiredValid$2 = 1;
  const Range = requireRange$1();
  const validRange = (range2, options) => {
    try {
      return new Range(range2, options).range || "*";
    } catch (er) {
      return null;
    }
  };
  valid$1 = validRange;
  return valid$1;
}
var outside_1$1;
var hasRequiredOutside$1;
function requireOutside$1() {
  if (hasRequiredOutside$1) return outside_1$1;
  hasRequiredOutside$1 = 1;
  const SemVer = requireSemver$4();
  const Comparator = requireComparator$1();
  const { ANY } = Comparator;
  const Range = requireRange$1();
  const satisfies = requireSatisfies$1();
  const gt = requireGt$1();
  const lt = requireLt$1();
  const lte = requireLte$1();
  const gte = requireGte$1();
  const outside = (version, range2, hilo, options) => {
    version = new SemVer(version, options);
    range2 = new Range(range2, options);
    let gtfn, ltefn, ltfn, comp, ecomp;
    switch (hilo) {
      case ">":
        gtfn = gt;
        ltefn = lte;
        ltfn = lt;
        comp = ">";
        ecomp = ">=";
        break;
      case "<":
        gtfn = lt;
        ltefn = gte;
        ltfn = gt;
        comp = "<";
        ecomp = "<=";
        break;
      default:
        throw new TypeError('Must provide a hilo val of "<" or ">"');
    }
    if (satisfies(version, range2, options)) {
      return false;
    }
    for (let i = 0; i < range2.set.length; ++i) {
      const comparators = range2.set[i];
      let high = null;
      let low = null;
      comparators.forEach((comparator2) => {
        if (comparator2.semver === ANY) {
          comparator2 = new Comparator(">=0.0.0");
        }
        high = high || comparator2;
        low = low || comparator2;
        if (gtfn(comparator2.semver, high.semver, options)) {
          high = comparator2;
        } else if (ltfn(comparator2.semver, low.semver, options)) {
          low = comparator2;
        }
      });
      if (high.operator === comp || high.operator === ecomp) {
        return false;
      }
      if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) {
        return false;
      } else if (low.operator === ecomp && ltfn(version, low.semver)) {
        return false;
      }
    }
    return true;
  };
  outside_1$1 = outside;
  return outside_1$1;
}
var gtr_1$1;
var hasRequiredGtr$1;
function requireGtr$1() {
  if (hasRequiredGtr$1) return gtr_1$1;
  hasRequiredGtr$1 = 1;
  const outside = requireOutside$1();
  const gtr = (version, range2, options) => outside(version, range2, ">", options);
  gtr_1$1 = gtr;
  return gtr_1$1;
}
var ltr_1$1;
var hasRequiredLtr$1;
function requireLtr$1() {
  if (hasRequiredLtr$1) return ltr_1$1;
  hasRequiredLtr$1 = 1;
  const outside = requireOutside$1();
  const ltr = (version, range2, options) => outside(version, range2, "<", options);
  ltr_1$1 = ltr;
  return ltr_1$1;
}
var intersects_1$1;
var hasRequiredIntersects$1;
function requireIntersects$1() {
  if (hasRequiredIntersects$1) return intersects_1$1;
  hasRequiredIntersects$1 = 1;
  const Range = requireRange$1();
  const intersects = (r1, r2, options) => {
    r1 = new Range(r1, options);
    r2 = new Range(r2, options);
    return r1.intersects(r2, options);
  };
  intersects_1$1 = intersects;
  return intersects_1$1;
}
var simplify$1;
var hasRequiredSimplify$1;
function requireSimplify$1() {
  if (hasRequiredSimplify$1) return simplify$1;
  hasRequiredSimplify$1 = 1;
  const satisfies = requireSatisfies$1();
  const compare = requireCompare$1();
  simplify$1 = (versions, range2, options) => {
    const set = [];
    let first = null;
    let prev = null;
    const v = versions.sort((a, b) => compare(a, b, options));
    for (const version of v) {
      const included = satisfies(version, range2, options);
      if (included) {
        prev = version;
        if (!first) {
          first = version;
        }
      } else {
        if (prev) {
          set.push([first, prev]);
        }
        prev = null;
        first = null;
      }
    }
    if (first) {
      set.push([first, null]);
    }
    const ranges = [];
    for (const [min, max] of set) {
      if (min === max) {
        ranges.push(min);
      } else if (!max && min === v[0]) {
        ranges.push("*");
      } else if (!max) {
        ranges.push(`>=${min}`);
      } else if (min === v[0]) {
        ranges.push(`<=${max}`);
      } else {
        ranges.push(`${min} - ${max}`);
      }
    }
    const simplified = ranges.join(" || ");
    const original = typeof range2.raw === "string" ? range2.raw : String(range2);
    return simplified.length < original.length ? simplified : range2;
  };
  return simplify$1;
}
var subset_1$1;
var hasRequiredSubset$1;
function requireSubset$1() {
  if (hasRequiredSubset$1) return subset_1$1;
  hasRequiredSubset$1 = 1;
  const Range = requireRange$1();
  const Comparator = requireComparator$1();
  const { ANY } = Comparator;
  const satisfies = requireSatisfies$1();
  const compare = requireCompare$1();
  const subset = (sub, dom, options = {}) => {
    if (sub === dom) {
      return true;
    }
    sub = new Range(sub, options);
    dom = new Range(dom, options);
    let sawNonNull = false;
    OUTER: for (const simpleSub of sub.set) {
      for (const simpleDom of dom.set) {
        const isSub = simpleSubset(simpleSub, simpleDom, options);
        sawNonNull = sawNonNull || isSub !== null;
        if (isSub) {
          continue OUTER;
        }
      }
      if (sawNonNull) {
        return false;
      }
    }
    return true;
  };
  const minimumVersionWithPreRelease = [new Comparator(">=0.0.0-0")];
  const minimumVersion = [new Comparator(">=0.0.0")];
  const simpleSubset = (sub, dom, options) => {
    if (sub === dom) {
      return true;
    }
    if (sub.length === 1 && sub[0].semver === ANY) {
      if (dom.length === 1 && dom[0].semver === ANY) {
        return true;
      } else if (options.includePrerelease) {
        sub = minimumVersionWithPreRelease;
      } else {
        sub = minimumVersion;
      }
    }
    if (dom.length === 1 && dom[0].semver === ANY) {
      if (options.includePrerelease) {
        return true;
      } else {
        dom = minimumVersion;
      }
    }
    const eqSet = /* @__PURE__ */ new Set();
    let gt, lt;
    for (const c of sub) {
      if (c.operator === ">" || c.operator === ">=") {
        gt = higherGT(gt, c, options);
      } else if (c.operator === "<" || c.operator === "<=") {
        lt = lowerLT(lt, c, options);
      } else {
        eqSet.add(c.semver);
      }
    }
    if (eqSet.size > 1) {
      return null;
    }
    let gtltComp;
    if (gt && lt) {
      gtltComp = compare(gt.semver, lt.semver, options);
      if (gtltComp > 0) {
        return null;
      } else if (gtltComp === 0 && (gt.operator !== ">=" || lt.operator !== "<=")) {
        return null;
      }
    }
    for (const eq of eqSet) {
      if (gt && !satisfies(eq, String(gt), options)) {
        return null;
      }
      if (lt && !satisfies(eq, String(lt), options)) {
        return null;
      }
      for (const c of dom) {
        if (!satisfies(eq, String(c), options)) {
          return false;
        }
      }
      return true;
    }
    let higher, lower;
    let hasDomLT, hasDomGT;
    let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
    let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
    if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === "<" && needDomLTPre.prerelease[0] === 0) {
      needDomLTPre = false;
    }
    for (const c of dom) {
      hasDomGT = hasDomGT || c.operator === ">" || c.operator === ">=";
      hasDomLT = hasDomLT || c.operator === "<" || c.operator === "<=";
      if (gt) {
        if (needDomGTPre) {
          if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) {
            needDomGTPre = false;
          }
        }
        if (c.operator === ">" || c.operator === ">=") {
          higher = higherGT(gt, c, options);
          if (higher === c && higher !== gt) {
            return false;
          }
        } else if (gt.operator === ">=" && !c.test(gt.semver)) {
          return false;
        }
      }
      if (lt) {
        if (needDomLTPre) {
          if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) {
            needDomLTPre = false;
          }
        }
        if (c.operator === "<" || c.operator === "<=") {
          lower = lowerLT(lt, c, options);
          if (lower === c && lower !== lt) {
            return false;
          }
        } else if (lt.operator === "<=" && !c.test(lt.semver)) {
          return false;
        }
      }
      if (!c.operator && (lt || gt) && gtltComp !== 0) {
        return false;
      }
    }
    if (gt && hasDomLT && !lt && gtltComp !== 0) {
      return false;
    }
    if (lt && hasDomGT && !gt && gtltComp !== 0) {
      return false;
    }
    if (needDomGTPre || needDomLTPre) {
      return false;
    }
    return true;
  };
  const higherGT = (a, b, options) => {
    if (!a) {
      return b;
    }
    const comp = compare(a.semver, b.semver, options);
    return comp > 0 ? a : comp < 0 ? b : b.operator === ">" && a.operator === ">=" ? b : a;
  };
  const lowerLT = (a, b, options) => {
    if (!a) {
      return b;
    }
    const comp = compare(a.semver, b.semver, options);
    return comp < 0 ? a : comp > 0 ? b : b.operator === "<" && a.operator === "<=" ? b : a;
  };
  subset_1$1 = subset;
  return subset_1$1;
}
var semver$3;
var hasRequiredSemver$3;
function requireSemver$3() {
  if (hasRequiredSemver$3) return semver$3;
  hasRequiredSemver$3 = 1;
  const internalRe = requireRe$1();
  const constants2 = requireConstants$1();
  const SemVer = requireSemver$4();
  const identifiers2 = requireIdentifiers$1();
  const parse = requireParse$1();
  const valid2 = requireValid$3();
  const clean = requireClean$1();
  const inc = requireInc$1();
  const diff = requireDiff$1();
  const major = requireMajor$1();
  const minor = requireMinor$1();
  const patch = requirePatch$1();
  const prerelease = requirePrerelease$1();
  const compare = requireCompare$1();
  const rcompare = requireRcompare$1();
  const compareLoose = requireCompareLoose$1();
  const compareBuild = requireCompareBuild$1();
  const sort = requireSort$1();
  const rsort = requireRsort$1();
  const gt = requireGt$1();
  const lt = requireLt$1();
  const eq = requireEq$1();
  const neq = requireNeq$1();
  const gte = requireGte$1();
  const lte = requireLte$1();
  const cmp = requireCmp$1();
  const coerce = requireCoerce$1();
  const truncate = requireTruncate$1();
  const Comparator = requireComparator$1();
  const Range = requireRange$1();
  const satisfies = requireSatisfies$1();
  const toComparators = requireToComparators$1();
  const maxSatisfying = requireMaxSatisfying$1();
  const minSatisfying = requireMinSatisfying$1();
  const minVersion = requireMinVersion$1();
  const validRange = requireValid$2();
  const outside = requireOutside$1();
  const gtr = requireGtr$1();
  const ltr = requireLtr$1();
  const intersects = requireIntersects$1();
  const simplifyRange = requireSimplify$1();
  const subset = requireSubset$1();
  semver$3 = {
    parse,
    valid: valid2,
    clean,
    inc,
    diff,
    major,
    minor,
    patch,
    prerelease,
    compare,
    rcompare,
    compareLoose,
    compareBuild,
    sort,
    rsort,
    gt,
    lt,
    eq,
    neq,
    gte,
    lte,
    cmp,
    coerce,
    truncate,
    Comparator,
    Range,
    satisfies,
    toComparators,
    maxSatisfying,
    minSatisfying,
    minVersion,
    validRange,
    outside,
    gtr,
    ltr,
    intersects,
    simplifyRange,
    subset,
    SemVer,
    re: internalRe.re,
    src: internalRe.src,
    tokens: internalRe.t,
    SEMVER_SPEC_VERSION: constants2.SEMVER_SPEC_VERSION,
    RELEASE_TYPES: constants2.RELEASE_TYPES,
    compareIdentifiers: identifiers2.compareIdentifiers,
    rcompareIdentifiers: identifiers2.rcompareIdentifiers
  };
  return semver$3;
}
var semverExports$2 = requireSemver$3();
function buildReleaseIdentity(baseVersion, packaged) {
  if (!packaged) return { version: `${baseVersion}-dev`, channel: "development" };
  return { version: baseVersion, channel: baseVersion.includes("-") ? "beta" : "stable" };
}
function normalizeUpdateChannel(value) {
  return value === "beta" || value === "preview" ? "beta" : "stable";
}
function buildUpdatePolicy(channel) {
  return { allowPrerelease: channel === "beta", allowDowngrade: false };
}
function isUpdateVersionEligible(currentVersion, candidateVersion, channel) {
  if (!semverExports$2.valid(currentVersion) || !semverExports$2.valid(candidateVersion) || !semverExports$2.gt(candidateVersion, currentVersion)) return false;
  const identifiers2 = semverExports$2.prerelease(candidateVersion);
  if (identifiers2 === null) return true;
  return channel === "beta" && typeof identifiers2[0] === "string" && ["beta", "rc"].includes(identifiers2[0]);
}
function formatAppBuildInfo(info) {
  return [
    `FORGE v${info.version}`,
    `Channel: ${info.channel}`,
    `Commit: ${info.commit}`,
    `Build date: ${info.buildDate}`,
    `Runtime: ${info.runtime}`,
    `Renderer: ${info.rendererSource}`,
    `Platform: ${info.platform} ${info.architecture}`
  ].join("\n");
}
const DEFAULT_WORKSPACE_LAYOUT = {
  explorerWidth: 245,
  intelligenceWidth: 360,
  bottomHeight: 240,
  contextHeight: 300
};
const IPC_CHANNELS = {
  workspaceOpen: "workspace.open",
  workspaceOpenHome: "workspace.open.home",
  workspaceInfo: "workspace.info",
  workspaceLayoutGet: "workspace.layout.get",
  workspaceLayoutSave: "workspace.layout.save",
  fileList: "file.list",
  fileRead: "file.read",
  fileMetadata: "file.metadata",
  filePreview: "file.preview",
  fileWrite: "file.write",
  fileCreate: "file.create",
  fileDelete: "file.delete",
  fileRename: "file.rename",
  fileCopy: "file.copy",
  markdownParse: "markdown.parse",
  gitStatus: "git.status",
  gitBranches: "git.branches",
  gitLog: "git.log",
  gitDiff: "git.diff",
  gitStage: "git.stage",
  gitUnstage: "git.unstage",
  gitCommit: "git.commit",
  gitPull: "git.pull",
  gitPush: "git.push",
  metaDashboard: "meta.dashboard",
  metaGoalCreate: "meta.goal.create",
  metaGoalUpdate: "meta.goal.update",
  metaGoalDelete: "meta.goal.delete",
  metaTaskCreate: "meta.task.create",
  appUpdateStatus: "app.update.status",
  appUpdateCheck: "app.update.check",
  appUpdateInstall: "app.update.install",
  appReleaseOpen: "app.release.open",
  appBuildInfo: "app.build.info",
  appBuildInfoCopy: "app.build.info.copy",
  settingsGet: "settings.get",
  settingsSave: "settings.save",
  settingsTestApi: "settings.test.api",
  settingsTestGithub: "settings.test.github",
  settingsModelsList: "settings.models.list",
  settingsModelValidate: "settings.model.validate",
  settingsEmbeddingModelsList: "settings.embedding.models.list",
  settingsEmbeddingModelValidate: "settings.embedding.model.validate",
  settingsRuntimeStatus: "settings.runtime.status",
  settingsPlatformCapabilities: "settings.platform.capabilities",
  semanticIndexStatus: "semantic.index.status",
  semanticIndexRebuild: "semantic.index.rebuild",
  contextHealthGet: "context.health.get",
  runtimeTelemetry: "runtime.telemetry",
  agentSkillsList: "agent.skills.list",
  agentAsk: "agent.ask",
  agentExplainProject: "agent.explainProject",
  agentReviewChanges: "agent.reviewChanges",
  agentConversationsState: "agent.conversations.state",
  agentConversationsList: "agent.conversations.list",
  agentConversationsAppend: "agent.conversations.append",
  agentConversationCreate: "agent.conversation.create",
  agentConversationSelect: "agent.conversation.select",
  agentConversationRename: "agent.conversation.rename",
  agentConversationClear: "agent.conversation.clear",
  agentConversationDelete: "agent.conversation.delete",
  agentConversationsClearAll: "agent.conversations.clearAll",
  agentMemoriesList: "agent.memories.list",
  agentMemoriesStats: "agent.memories.stats",
  agentMemoriesDelete: "agent.memories.delete",
  agentMemoriesClear: "agent.memories.clear",
  agentMemoriesReindex: "agent.memories.reindex",
  toolRequestsList: "tool.requests.list",
  toolRequestCancel: "tool.request.cancel",
  toolActionsList: "tool.actions.list",
  toolCatalog: "tool.catalog",
  toolExecute: "tool.execute",
  editorDirtyUpdate: "editor.dirty.update",
  agentStopAll: "agent.stop.all",
  terminalCreate: "terminal.create",
  terminalList: "terminal.list",
  terminalInput: "terminal.input",
  terminalResize: "terminal.resize",
  terminalTerminate: "terminal.terminate",
  terminalRestart: "terminal.restart",
  terminalRemove: "terminal.remove",
  tasksList: "tasks.list",
  tasksGet: "tasks.get",
  tasksCreate: "tasks.create",
  tasksUpdate: "tasks.update",
  tasksCreateRelease: "tasks.create.release",
  tasksResume: "tasks.resume",
  tasksPause: "tasks.pause",
  tasksCancel: "tasks.cancel",
  tasksRedirect: "tasks.redirect",
  tasksDelete: "tasks.delete",
  tasksRetryStep: "tasks.retry.step",
  tasksHandoff: "tasks.handoff",
  browserNavigate: "browser.navigate",
  browserLayout: "browser.layout",
  browserBack: "browser.back",
  browserForward: "browser.forward",
  browserReload: "browser.reload",
  browserHome: "browser.home",
  browserTabNew: "browser.tab.new",
  browserTabClose: "browser.tab.close",
  browserTabSelect: "browser.tab.select",
  browserBookmarkAdd: "browser.bookmark.add",
  browserBookmarkRemove: "browser.bookmark.remove",
  forgeLiveStart: "forge-live.start",
  forgeLiveStop: "forge-live.stop",
  forgeLiveRestart: "forge-live.restart",
  forgeLiveStatus: "forge-live.status",
  forgeLiveOpenPreview: "forge-live.open-preview",
  forgeLiveCopyUrl: "forge-live.copy-url",
  forgeOsContext: "forge-os.context",
  forgeOsApplications: "forge-os.applications",
  forgeOsApplicationLaunch: "forge-os.application.launch",
  forgeOsOverview: "forge-os.overview",
  forgeOsSessionAction: "forge-os.session.action"
};
const IGNORED = /* @__PURE__ */ new Set([".git", "node_modules", "dist", "out", "build", ".next", ".forge", "coverage", "__pycache__"]);
const IGNORED_PATH_PATTERNS = [
  /(?:^|[/])\.local[/]share[/]containers(?:[/]|$)/i,
  /(?:^|[/])\.cache(?:[/]|$)/i,
  /(?:^|[/])\.npm(?:[/]|$)/i,
  /(?:^|[/])\.cargo[/]registry(?:[/]|$)/i,
  /(?:^|[/])\.rustup(?:[/]|$)/i
];
function isSkippableFileSystemError(error) {
  return error instanceof Error && "code" in error && ["EACCES", "EPERM", "ENOENT"].includes(String(error.code));
}
function shouldIgnore(relativePath2, showHidden = true) {
  const normalized = relativePath2.replaceAll("\\", "/");
  return normalized.split("/").some((part) => part.startsWith(".") && !showHidden || IGNORED.has(part) && !(showHidden && part.startsWith("."))) || IGNORED_PATH_PATTERNS.some((pattern) => pattern.test(normalized) && !showHidden);
}
function shouldWatchRecursively(workspaceRoot, homeDirectory = homedir()) {
  const root = path.resolve(workspaceRoot);
  const home = path.resolve(homeDirectory);
  return root !== home && root !== path.parse(root).root && !home.startsWith(`${root}${path.sep}`);
}
const mimeByExtension = {
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  log: "text/plain",
  csv: "text/csv",
  ini: "text/plain",
  conf: "text/plain",
  env: "text/plain",
  json: "application/json",
  jsonc: "application/json",
  yaml: "application/yaml",
  yml: "application/yaml",
  toml: "application/toml",
  xml: "application/xml",
  sh: "text/x-shellscript",
  bash: "text/x-shellscript",
  zsh: "text/x-shellscript",
  fish: "text/x-shellscript",
  ps1: "text/x-powershell",
  bat: "text/plain",
  cmd: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  m4a: "audio/mp4",
  aac: "audio/aac",
  mp4: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  mov: "video/quicktime"
};
const textExtensions = /* @__PURE__ */ new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "jsonc", "md", "markdown", "txt", "log", "html", "htm", "css", "scss", "sass", "less", "xml", "yaml", "yml", "toml", "ini", "conf", "env", "py", "rb", "php", "java", "kt", "kts", "c", "h", "cpp", "hpp", "cc", "rs", "go", "swift", "sql", "graphql", "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd"]);
const textNames = /* @__PURE__ */ new Set([".env", ".env.local", ".env.example", ".gitignore", ".gitattributes", ".editorconfig", ".npmrc", ".yarnrc", "dockerfile", "makefile", "readme", "license", "changelog"]);
const CLASSIFICATION_SAMPLE_BYTES = 64 * 1024;
const MAX_EDITOR_FILE_BYTES = 32 * 1024 * 1024;
const MAX_MEDIA_PREVIEW_BYTES = 100 * 1024 * 1024;
function isKnownTextFile(name, extension) {
  return textExtensions.has(extension) || textNames.has(name.toLowerCase()) || name.toLowerCase().startsWith(".env.");
}
function isTextSample(sample, knownText) {
  if (sample.length === 0 || sample.includes(0)) return false;
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(sample);
    if (decoded.startsWith("#!") || knownText) return true;
    let controls = 0;
    for (const character of decoded) {
      const code = character.codePointAt(0);
      if (code < 32 && ![9, 10, 13, 12].includes(code) || code >= 127 && code <= 159) controls += 1;
    }
    return controls / Math.max(1, decoded.length) <= 0.02;
  } catch {
    return false;
  }
}
function classifyFile(input) {
  const extension = input.extension.toLowerCase();
  const mimeType = input.mimeType.toLowerCase();
  const knownText = isKnownTextFile(input.name ?? "", extension);
  if (mimeType.startsWith("image/")) return { kind: "image", text: false };
  if (mimeType.startsWith("audio/")) return { kind: "audio", text: false };
  if (mimeType.startsWith("video/")) return { kind: "video", text: false };
  const text = input.sample.length === 0 ? knownText || mimeType.startsWith("text/") : isTextSample(input.sample, knownText || mimeType.startsWith("text/"));
  if (text) return { kind: input.executable ? "executable" : "text", text: true };
  return { kind: input.executable ? "executable" : "binary", text: false };
}
function parseMarkdown(content) {
  const frontmatter = {};
  const matched = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const body = matched ? content.slice(matched[0].length) : content;
  if (matched) for (const line of matched[1].split(/\r?\n/)) {
    const pair = line.match(/^([\w-]+):\s*(.+)$/);
    if (pair) frontmatter[pair[1]] = pair[2].startsWith("[") ? pair[2].slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean) : pair[2].replace(/^['"]|['"]$/g, "");
  }
  const wikiLinks = [...body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map((m) => m[1].trim());
  const tags = [];
  let fenced = false;
  for (const line of body.split(/\r?\n/)) {
    if (line.trim().startsWith("```")) {
      fenced = !fenced;
      continue;
    }
    if (!fenced) tags.push(...[...line.matchAll(/(?:^|\s)#([\w-]+)/g)].map((m) => m[1]));
  }
  const headings = [...body.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((m) => ({ level: m[1].length, text: m[2].trim(), slug: m[2].trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-") }));
  return { content: body, frontmatter, wikiLinks: [...new Set(wikiLinks)], tags: [...new Set(tags)], headings };
}
class WorkspaceService extends EventEmitter {
  rootPath = null;
  realRoot = null;
  workspaceInfo = null;
  watcher;
  async open(rootPath) {
    const stat = await promises.stat(rootPath);
    if (!stat.isDirectory()) throw new Error("Workspace must be a directory.");
    this.rootPath = path.resolve(rootPath);
    this.realRoot = await promises.realpath(this.rootPath);
    const gitPath = path.join(this.rootPath, ".git");
    const gitRoot = await promises.access(gitPath).then(() => gitPath).catch(() => null);
    this.workspaceInfo = { rootPath: this.rootPath, name: path.basename(this.rootPath), gitRoot, createdAt: stat.birthtimeMs };
    return { ...this.workspaceInfo };
  }
  info() {
    return this.workspaceInfo ? { ...this.workspaceInfo } : null;
  }
  async close() {
    this.watcher?.close();
    this.watcher = void 0;
    this.rootPath = null;
    this.realRoot = null;
    this.workspaceInfo = null;
  }
  async list(relativePath2 = "", options = {}) {
    const budget = { count: 0, maximum: Math.max(1, options.maxEntries ?? 5e3) };
    return this.listDirectory(await this.resolve(relativePath2), relativePath2, options.recursive !== false, budget, options.showHidden ?? false);
  }
  async readFile(relativePath2) {
    const absolute = await this.resolve(relativePath2);
    const stat = await promises.stat(absolute);
    if (!stat.isFile()) throw new Error("Path is not a file.");
    if (stat.size > MAX_EDITOR_FILE_BYTES) throw new Error("Direct file reads are limited to 32 MB to protect the FORGE runtime. Use a bounded tool, external viewer, or split the file.");
    const bytes = await promises.readFile(absolute);
    if (bytes.includes(0)) return { path: relativePath2, content: bytes.toString("base64"), modifiedAt: stat.mtimeMs, encoding: "base64", binary: true };
    let content;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("Forge could not decode this file as UTF-8 text.");
    }
    return { path: relativePath2, content, modifiedAt: stat.mtimeMs, encoding: content.startsWith("\uFEFF") ? "utf8-bom" : "utf8" };
  }
  async metadata(relativePath2) {
    const absolute = await this.resolve(relativePath2);
    const stat = await promises.stat(absolute);
    const extension = path.extname(absolute).slice(1).toLowerCase();
    const bytes = stat.isFile() ? await promises.open(absolute, "r").then(async (handle) => {
      const buffer = Buffer.alloc(CLASSIFICATION_SAMPLE_BYTES);
      try {
        const result = await handle.read(buffer, 0, buffer.length, 0);
        return buffer.subarray(0, result.bytesRead);
      } finally {
        await handle.close();
      }
    }) : Buffer.alloc(0);
    const signatureBytes = Buffer.alloc(8);
    bytes.copy(signatureBytes);
    const signature = bytes.length >= 4 ? signatureBytes.toString("hex").match(/.{2}/g)?.join(" ") : void 0;
    const executable = process.platform === "win32" ? [".exe", ".bat", ".cmd", ".ps1"].includes(path.extname(absolute).toLowerCase()) : Boolean(stat.mode & 73);
    const name = path.basename(absolute);
    const lowerName = name.toLowerCase();
    const resolvedExtension = extension || (textNames.has(lowerName) || lowerName.startsWith(".env.") ? lowerName.slice(1) : "");
    const mimeType = mimeByExtension[resolvedExtension] ?? (bytes[0] === 127 && bytes[1] === 69 ? "application/x-elf" : "application/octet-stream");
    const classification = classifyFile({ name, extension: resolvedExtension, mimeType, sample: bytes, executable });
    return { path: relativePath2, name, extension: extension || void 0, size: stat.size, modifiedAt: stat.mtimeMs, createdAt: stat.birthtimeMs, mimeType, kind: classification.kind, text: classification.text, executable, permissions: process.platform === "win32" ? void 0 : (stat.mode & 511).toString(8), signature };
  }
  async preview(relativePath2) {
    const metadata = await this.metadata(relativePath2);
    if (!["image", "audio", "video"].includes(metadata.kind)) throw new Error("This file does not have a safe media preview.");
    if (metadata.size > MAX_MEDIA_PREVIEW_BYTES) throw new Error("Media preview is limited to 100 MB.");
    const bytes = await promises.readFile(await this.resolve(relativePath2));
    return { path: relativePath2, mimeType: metadata.mimeType, dataUrl: `data:${metadata.mimeType};base64,${bytes.toString("base64")}` };
  }
  async writeFile(relativePath2, content) {
    const absolute = await this.resolve(relativePath2, true);
    await promises.mkdir(path.dirname(absolute), { recursive: true });
    await promises.writeFile(absolute, content, "utf8");
    const stat = await promises.stat(absolute);
    return { path: relativePath2, content, modifiedAt: stat.mtimeMs };
  }
  async create(relativePath2, type, content = "") {
    const absolute = await this.resolve(relativePath2, true);
    await promises.mkdir(path.dirname(absolute), { recursive: true });
    if (type === "directory") await promises.mkdir(absolute, { recursive: false });
    else await promises.writeFile(absolute, content, { flag: "wx" });
    return this.nodeFor(absolute);
  }
  async delete(relativePath2) {
    const absolute = await this.resolve(relativePath2);
    if (absolute === this.realRoot) throw new Error("Cannot delete the workspace root.");
    await promises.rm(absolute, { recursive: true, force: false });
  }
  async rename(oldPath, newPath) {
    const oldAbsolute = await this.resolve(oldPath);
    const newAbsolute = await this.resolve(newPath, true);
    await promises.mkdir(path.dirname(newAbsolute), { recursive: true });
    await promises.rename(oldAbsolute, newAbsolute);
    return this.nodeFor(newAbsolute);
  }
  async copy(sourcePath, destinationPath) {
    const source = await this.resolve(sourcePath);
    const destination = await this.resolve(destinationPath, true);
    if (source === destination) throw new Error("Cannot paste a file or folder onto itself.");
    await promises.access(destination).then(() => {
      throw new Error(`A file or folder already exists at ${destinationPath}.`);
    }).catch((error) => {
      if (error instanceof Error && !("code" in error && error.code === "ENOENT")) throw error;
    });
    await promises.mkdir(path.dirname(destination), { recursive: true });
    const sourceStat = await promises.stat(source);
    if (sourceStat.isDirectory() && destination.startsWith(`${source}${path.sep}`)) throw new Error("A folder cannot be copied into itself or one of its children.");
    await promises.cp(source, destination, { recursive: sourceStat.isDirectory(), force: false, errorOnExist: true });
    return this.nodeFor(destination);
  }
  async parse(relativePath2) {
    return parseMarkdown((await this.readFile(relativePath2)).content);
  }
  watch() {
    if (!this.rootPath) throw new Error("No workspace is open.");
    this.watcher?.close();
    try {
      this.watcher = watch(this.rootPath, { recursive: shouldWatchRecursively(this.rootPath) }, (_event, filename) => {
        if (filename && !shouldIgnore(filename.toString())) this.emit("changed", filename.toString());
      });
      this.watcher.on("error", (error) => {
        this.watcher?.close();
        if (!isSkippableFileSystemError(error)) this.emit("watch-error", error);
      });
    } catch (error) {
      if (!isSkippableFileSystemError(error)) throw error;
    }
  }
  async listDirectory(absolute, relative, recursive, budget, showHidden = true) {
    let entries;
    try {
      entries = await promises.readdir(absolute, { withFileTypes: true });
    } catch (error) {
      if (isSkippableFileSystemError(error)) return [];
      throw error;
    }
    const nodes = [];
    for (const entry of entries) {
      if (budget.count >= budget.maximum) break;
      const childRelative = relative ? path.join(relative, entry.name) : entry.name;
      if (shouldIgnore(childRelative, showHidden) || entry.isSymbolicLink()) continue;
      const childAbsolute = path.join(absolute, entry.name);
      try {
        const node = entry.isDirectory() && !recursive ? { path: childAbsolute, relativePath: childRelative.replaceAll("\\", "/"), name: entry.name, type: "directory", modifiedAt: 0 } : await this.nodeFor(childAbsolute, childRelative);
        budget.count += 1;
        if (entry.isDirectory() && recursive) node.children = await this.listDirectory(childAbsolute, childRelative, recursive, budget, showHidden);
        nodes.push(node);
      } catch (error) {
        if (!isSkippableFileSystemError(error)) throw error;
      }
    }
    return nodes.sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1);
  }
  async nodeFor(absolute, relative = path.relative(this.rootPath, absolute)) {
    const stat = await promises.stat(absolute);
    return { path: absolute, relativePath: relative.replaceAll("\\", "/"), name: path.basename(absolute), type: stat.isDirectory() ? "directory" : "file", extension: stat.isFile() ? path.extname(absolute).slice(1) || void 0 : void 0, size: stat.isFile() ? stat.size : void 0, modifiedAt: stat.mtimeMs };
  }
  async resolve(input, allowMissing = false) {
    if (!this.rootPath || !this.realRoot) throw new Error("No workspace is open.");
    if (path.isAbsolute(input)) throw new Error("Workspace paths must be relative.");
    const candidate = path.resolve(this.rootPath, input);
    if (candidate !== this.rootPath && !candidate.startsWith(`${this.rootPath}${path.sep}`)) throw new Error("Path escapes the workspace.");
    let inspect = candidate;
    if (allowMissing) while (inspect !== this.rootPath) {
      try {
        await promises.access(inspect);
        break;
      } catch {
        inspect = path.dirname(inspect);
      }
    }
    const resolved = await promises.realpath(inspect);
    if (resolved !== this.realRoot && !resolved.startsWith(`${this.realRoot}${path.sep}`)) throw new Error("Symlink escapes the workspace.");
    return candidate;
  }
}
const bounded$1 = (value) => JSON.parse(JSON.stringify(value).slice(0, 15e5));
class GitHubService {
  constructor(origin, credentials, requestImpl = fetch) {
    this.origin = origin;
    this.credentials = credentials;
    this.requestImpl = requestImpl;
  }
  async read(resource, options = {}) {
    const page = Math.min(Math.max(options.page ?? 1, 1), 100);
    let suffix = "";
    switch (resource) {
      case "metadata":
        break;
      case "branches":
        suffix = `/branches?per_page=100&page=${page}`;
        break;
      case "commits":
        suffix = `/commits?per_page=100&page=${page}`;
        break;
      case "issues":
        suffix = `/issues?state=all&per_page=100&page=${page}`;
        break;
      case "pulls":
        suffix = `/pulls?state=all&per_page=100&page=${page}`;
        break;
      case "issue-comments":
        suffix = `/issues/${required(options.number, "number")}/comments?per_page=100&page=${page}`;
        break;
      case "pull-comments":
        suffix = `/pulls/${required(options.number, "number")}/comments?per_page=100&page=${page}`;
        break;
      case "workflow-runs":
        suffix = `/actions/runs?per_page=100&page=${page}`;
        break;
      case "workflow-jobs":
        suffix = `/actions/runs/${required(options.runId, "runId")}/jobs?per_page=100&page=${page}`;
        break;
      case "releases":
        suffix = `/releases?per_page=100&page=${page}`;
        break;
      case "release-assets":
        suffix = `/releases/${required(options.releaseId, "releaseId")}/assets?per_page=100&page=${page}`;
        break;
    }
    return this.api(suffix, "GET");
  }
  async mutate(action, input) {
    let operation;
    switch (action) {
      case "create-issue":
        operation = { method: "POST", path: "/issues", body: pick(input, "title", "body", "labels", "assignees") };
        break;
      case "update-issue":
        operation = { method: "PATCH", path: `/issues/${requiredNumber(input.number, "number")}`, body: pick(input, "title", "body", "state", "labels", "assignees") };
        break;
      case "comment-issue":
        operation = { method: "POST", path: `/issues/${requiredNumber(input.number, "number")}/comments`, body: pick(input, "body") };
        break;
      case "create-branch":
        operation = { method: "POST", path: "/git/refs", body: { ref: `refs/heads/${requiredString(input.branch, "branch")}`, sha: requiredString(input.sha, "sha") } };
        break;
      case "create-file":
        operation = { method: "PUT", path: `/contents/${encodeURIComponent(requiredString(input.path, "path")).replace(/%2F/g, "/")}`, body: pick(input, "message", "content", "branch", "sha") };
        break;
      case "create-pull-request":
        operation = { method: "POST", path: "/pulls", body: pick(input, "title", "head", "base", "body", "draft") };
        break;
      case "comment-pull-request":
        operation = { method: "POST", path: `/issues/${requiredNumber(input.number, "number")}/comments`, body: pick(input, "body") };
        break;
      case "retry-workflow":
        operation = { method: "POST", path: `/actions/runs/${requiredNumber(input.runId, "runId")}/rerun`, body: {} };
        break;
      case "create-release":
        operation = { method: "POST", path: "/releases", body: pick(input, "tag_name", "target_commitish", "name", "body", "draft", "prerelease") };
        break;
      case "update-release":
        operation = { method: "PATCH", path: `/releases/${requiredNumber(input.releaseId, "releaseId")}`, body: pick(input, "tag_name", "target_commitish", "name", "body", "draft", "prerelease") };
        break;
    }
    return this.api(operation.path, operation.method, operation.body, true);
  }
  async api(path2, method, body, requireCredentials = false) {
    const repository = await this.repository();
    const credentials = await this.credentials?.();
    if (requireCredentials && !credentials) throw new Error("A GitHub token is required for this operation.");
    const response = await this.requestImpl(`https://api.github.com/repos/${repository.owner}/${repository.repo}${path2}`, { method, headers: { Accept: "application/vnd.github+json", "User-Agent": "FORGE-desktop", ...credentials ? { Authorization: `Bearer ${credentials.token}` } : {}, ...body === void 0 ? {} : { "Content-Type": "application/json" } }, body: body === void 0 ? void 0 : JSON.stringify(body) });
    if (!response.ok) throw new Error(`GitHub API request failed (${response.status}).`);
    if (response.status === 204) return { success: true };
    return bounded$1(await response.json());
  }
  async repository() {
    const origin = await this.origin();
    const match = /github\.com[/:]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i.exec(origin);
    if (!match) throw new Error("The active Git remote is not a supported GitHub repository.");
    return { owner: match[1], repo: match[2] };
  }
}
const required = (value, name) => {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`GitHub ${name} is required.`);
  return value;
};
const requiredNumber = (value, name) => required(typeof value === "number" ? value : void 0, name);
const requiredString = (value, name) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`GitHub ${name} is required.`);
  return value.trim();
};
const pick = (value, ...keys) => Object.fromEntries(keys.filter((key) => value[key] !== void 0).map((key) => [key, value[key]]));
const safeFiles = (files) => files.map((file) => {
  if (!file || file.startsWith("/") || file.split(/[\\/]/).includes("..")) throw new Error("Git paths must be workspace-relative.");
  return file;
});
const toCommit = (entry) => ({ hash: entry.hash, shortHash: entry.hash.slice(0, 7), author: entry.author_name, email: entry.author_email, message: entry.message, timestamp: new Date(entry.date).getTime() });
class GitService {
  constructor(credentials) {
    this.credentials = credentials;
  }
  git = null;
  rootPath = null;
  async init(rootPath) {
    const git2 = simpleGit(rootPath);
    if (!await git2.checkIsRepo()) {
      this.git = null;
      this.rootPath = null;
      return false;
    }
    this.git = git2;
    this.rootPath = rootPath;
    return true;
  }
  async status() {
    const git2 = this.ready();
    const summary = await git2.status();
    let head = null;
    try {
      const log = await git2.log({ maxCount: 1 });
      if (log.latest) head = toCommit(log.latest);
    } catch {
    }
    return { branch: summary.current || "HEAD", ahead: summary.ahead, behind: summary.behind, files: summary.files.map((file) => ({ path: file.path, indexStatus: file.index, workingStatus: file.working_dir, untracked: file.index === "?" || file.working_dir === "?" })), head };
  }
  async branches() {
    const data = await this.ready().branch(["-a"]);
    return data.all.map((name) => ({ name, current: name === data.current }));
  }
  async log(limit = 30) {
    return (await this.ready().log({ maxCount: Math.min(Math.max(limit, 1), 100) })).all.map(toCommit);
  }
  async stage(files) {
    await this.ready().add(safeFiles(files));
  }
  async unstage(files) {
    await this.ready().raw(["reset", "HEAD", "--", ...safeFiles(files)]);
  }
  async commit(message, files) {
    if (!message.trim()) throw new Error("Commit message is required.");
    const git2 = this.ready();
    if (files?.length) await git2.add(safeFiles(files));
    await git2.commit(message.trim());
    const latest = (await git2.log({ maxCount: 1 })).latest;
    if (!latest) throw new Error("Git did not return the new commit.");
    return toCommit(latest);
  }
  async pull() {
    const git2 = await this.remoteGit();
    const branch = (await git2.branch()).current;
    await git2.pull("origin", branch);
  }
  async push() {
    const git2 = await this.remoteGit();
    const branch = (await git2.branch()).current;
    await git2.push("origin", branch, ["--set-upstream"]);
  }
  async originUrl() {
    const origin = await this.ready().remote(["get-url", "origin"]);
    if (typeof origin !== "string" || !origin.trim()) throw new Error("The active Git repository has no origin remote.");
    return origin.trim();
  }
  async diff(staged) {
    const text = await this.ready().diff(staged ? ["--cached", "--no-color"] : ["--no-color"]);
    return parseDiff(text);
  }
  ready() {
    if (!this.git) throw new Error("The opened workspace is not a Git repository.");
    return this.git;
  }
  async remoteGit() {
    const git2 = this.ready();
    const remote = await git2.remote(["get-url", "origin"]).catch(() => void 0);
    if (typeof remote !== "string" || !/^https:\/\/github\.com\//i.test(remote.trim()) || !this.credentials || !this.rootPath) return git2;
    const credentials = await this.credentials();
    if (!credentials) return git2;
    return simpleGit({ baseDir: this.rootPath }).env({
      ...process.env,
      GIT_ASKPASS: credentials.askPassPath,
      GIT_TERMINAL_PROMPT: "0",
      FORGE_GITHUB_USERNAME: credentials.username,
      FORGE_GITHUB_TOKEN: credentials.token
    });
  }
}
function parseDiff(text) {
  const files = [];
  let current;
  let oldLine = 0;
  let newLine = 0;
  for (const line of text.split("\n")) {
    const header = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (header) {
      current = { path: header[2], status: "M", additions: 0, deletions: 0, lines: [] };
      files.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith("new file")) {
      current.status = "A";
      continue;
    }
    if (line.startsWith("deleted file")) {
      current.status = "D";
      continue;
    }
    if (line.startsWith("rename ")) {
      current.status = "R";
      continue;
    }
    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("\\")) continue;
    let diffLine;
    if (line.startsWith("+")) {
      diffLine = { type: "addition", oldLineNumber: null, newLineNumber: newLine++, content: line.slice(1) };
      current.additions++;
    } else if (line.startsWith("-")) {
      diffLine = { type: "deletion", oldLineNumber: oldLine++, newLineNumber: null, content: line.slice(1) };
      current.deletions++;
    } else if (line.startsWith(" ")) diffLine = { type: "context", oldLineNumber: oldLine++, newLineNumber: newLine++, content: line.slice(1) };
    if (diffLine) current.lines.push(diffLine);
  }
  return { files };
}
const id = () => randomUUID();
const CURRENT_SCHEMA_VERSION = 12;
const MAX_MEMORY_CONTENT_CHARS = 2e5;
const MAX_MEMORY_METADATA_CHARS = 1e5;
const MAX_PROJECT_OBSERVATIONS = 2e3;
const TASK_STATUSES = /* @__PURE__ */ new Set(["draft", "ready", "running", "waiting", "blocked", "paused", "failed", "cancelled", "completed"]);
const STEP_STATUSES = /* @__PURE__ */ new Set(["pending", "running", "waiting", "blocked", "failed", "skipped", "completed"]);
function normalizeTaskDraft(input) {
  const title = input.title.trim();
  const objective = input.description?.trim() || title || "the requested objective";
  const steps = input.steps.length ? input.steps : [{ id: "define-objective", name: "Define and verify the objective", purpose: `Clarify and complete ${objective}.`, riskTier: 0, verificationCriteria: ["The objective and next action are recorded."], dependencies: [] }];
  return { ...input, title, taskType: input.taskType?.trim() || "custom", resumeInstructions: input.resumeInstructions?.trim() || "Reconcile the workspace, complete pending steps, and verify each criterion before advancing.", progressSummary: input.progressSummary?.trim() || "Draft task created; complete the definition before running.", steps: steps.map((step, index) => ({ ...step, id: step.id?.trim() || `step-${index + 1}`, name: step.name?.trim() || `Step ${index + 1}`, purpose: step.purpose?.trim() || `Complete step ${index + 1} for ${objective}.`, riskTier: step.riskTier ?? 0, verificationCriteria: (step.verificationCriteria ?? []).map((criterion) => criterion.trim()).filter(Boolean).length ? (step.verificationCriteria ?? []).map((criterion) => criterion.trim()).filter(Boolean) : ["The step result is observed and recorded."], dependencies: step.dependencies ?? [], artifactPaths: step.artifactPaths ?? [] })) };
}
function normalizeTitle(value) {
  const title = value?.trim() || "New conversation";
  return title.slice(0, 120);
}
function titleFromPrompt(prompt) {
  const singleLine = prompt.replace(/\s+/g, " ").trim();
  return singleLine.length > 52 ? `${singleLine.slice(0, 49)}…` : singleLine || "New conversation";
}
function clamp(value, minimum, maximum, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.round(value))) : fallback;
}
function parseJson(value, fallback) {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
function sanitizeTaskData(value) {
  if (Array.isArray(value)) return value.map(sanitizeTaskData);
  if (!value || typeof value !== "object") return typeof value === "string" && /(?:sk-|github_pat_|gh[oprsu]_)[A-Za-z0-9_-]{10,}/.test(value) ? "[REDACTED]" : value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, /token|secret|password|authorization|credential|api.?key/i.test(key) ? "[REDACTED]" : sanitizeTaskData(entry)]));
}
function normalizeWorkspaceLayout(value) {
  return {
    explorerWidth: clamp(value?.explorerWidth, 180, 520, DEFAULT_WORKSPACE_LAYOUT.explorerWidth),
    intelligenceWidth: clamp(value?.intelligenceWidth, 300, 720, DEFAULT_WORKSPACE_LAYOUT.intelligenceWidth),
    bottomHeight: clamp(value?.bottomHeight, 150, 520, DEFAULT_WORKSPACE_LAYOUT.bottomHeight),
    contextHeight: clamp(value?.contextHeight, 160, 650, DEFAULT_WORKSPACE_LAYOUT.contextHeight)
  };
}
class StorageService {
  db = null;
  sql = null;
  filePath = null;
  rootPath = null;
  persistQueue = Promise.resolve();
  semanticWriteBatchDepth = 0;
  semanticWriteDirty = false;
  async init(rootPath) {
    const directory = path.join(rootPath, ".forge");
    await promises.mkdir(directory, { recursive: true });
    this.filePath = path.join(directory, "metadata.sqlite");
    this.rootPath = rootPath;
    const SQL = await initSqlJs();
    this.sql = SQL;
    const bytes = await promises.readFile(this.filePath).catch(() => null);
    if (bytes) {
      try {
        this.db = openHealthyDatabase(SQL, bytes);
      } catch (primaryError) {
        const backupPath2 = `${this.filePath}.backup`;
        const backupBytes = await promises.readFile(backupPath2).catch(() => null);
        if (!backupBytes) throw malformedDatabaseError(this.filePath, primaryError);
        try {
          this.db = openHealthyDatabase(SQL, backupBytes);
        } catch (backupError) {
          throw malformedDatabaseError(this.filePath, primaryError, backupError);
        }
        const preservedPath = `${this.filePath}.corrupt-${Date.now()}`;
        const recoveryTemporary = `${this.filePath}.${id()}.tmp`;
        await promises.copyFile(this.filePath, preservedPath);
        try {
          await writeSyncedFile(recoveryTemporary, backupBytes);
          await promises.rename(recoveryTemporary, this.filePath);
        } catch (error) {
          await promises.rm(recoveryTemporary, { force: true }).catch(() => void 0);
          throw error;
        }
        console.warn(`Recovered malformed workspace database from ${backupPath2}; preserved original at ${preservedPath}.`);
      }
    } else this.db = new SQL.Database();
    this.db.run("PRAGMA foreign_keys = ON");
    this.createSchema();
    await this.ensureProject();
    await this.migrateLegacyConversations();
    if (this.pruneProjectObservations()) this.db.run("VACUUM");
    this.db.run(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`);
    await this.persist();
  }
  async close() {
    await this.persist();
    this.db?.close();
    this.db = null;
    this.sql = null;
    this.filePath = null;
    this.rootPath = null;
  }
  async dashboard() {
    const project = this.one("SELECT * FROM projects WHERE root_path = ?", [this.rootPath]);
    if (!project) return null;
    return {
      id: String(project.id),
      name: String(project.name),
      rootPath: String(project.root_path),
      createdAt: Number(project.created_at),
      updatedAt: Number(project.updated_at),
      goals: this.goals(String(project.id)),
      tasks: this.tasks(String(project.id))
    };
  }
  async createGoal(title, description) {
    if (!title.trim()) throw new Error("Goal title is required.");
    const projectId = await this.projectId();
    const now = Date.now();
    const goal = { id: id(), title: title.trim(), description, status: "active", createdAt: now, updatedAt: now };
    this.ready().run("INSERT INTO goals VALUES (?, ?, ?, ?, ?, ?, ?)", [goal.id, projectId, goal.title, description ?? null, goal.status, now, now]);
    await this.persist();
    return goal;
  }
  async updateGoal(goalId, title, description, status = "active") {
    if (!title.trim()) throw new Error("Goal title is required.");
    if (!["active", "completed", "archived"].includes(status)) throw new Error("Goal status is invalid.");
    const projectId = await this.projectId();
    if (!this.one("SELECT id FROM goals WHERE id = ? AND project_id = ?", [goalId, projectId])) throw new Error("Goal was not found in the active workspace.");
    this.ready().run("UPDATE goals SET title = ?, description = ?, status = ?, updated_at = ? WHERE id = ? AND project_id = ?", [title.trim(), description ?? null, status, Date.now(), goalId, projectId]);
    await this.persist();
    return this.dashboard().then((project) => project?.goals.find((goal) => goal.id === goalId) ?? (() => {
      throw new Error("Goal could not be reloaded.");
    })());
  }
  async deleteGoal(goalId) {
    const projectId = await this.projectId();
    if (!this.one("SELECT id FROM goals WHERE id = ? AND project_id = ?", [goalId, projectId])) throw new Error("Goal was not found in the active workspace.");
    this.ready().run("DELETE FROM goals WHERE id = ? AND project_id = ?", [goalId, projectId]);
    await this.persist();
  }
  async createTask(title, description, priority = "medium") {
    return this.createPersistentTask({ title, description, taskType: "general", priority, progressSummary: "Draft task created from workspace metadata.", resumeInstructions: "Inspect the workspace and define verified steps before starting.", steps: [] });
  }
  async createPersistentTask(draft) {
    draft = normalizeTaskDraft(draft);
    if (!draft.title.trim()) throw new Error("Task title is required.");
    if (draft.title.length > 240) throw new Error("Task title is too long.");
    if (!draft.taskType.trim()) throw new Error("Task type is required.");
    if (draft.taskType.length > 100 || (draft.description?.length ?? 0) > 2e4) throw new Error("Task type or description is too long.");
    if (!draft.resumeInstructions.trim()) throw new Error("Safe resume instructions are required.");
    if (draft.resumeInstructions.length > 2e4 || draft.steps.length > 200 || (draft.taskDependencies?.length ?? 0) > 100) throw new Error("Task resume instructions, steps, or dependencies exceed the storage limit.");
    if (JSON.stringify(sanitizeTaskData(draft)).length > 1e6) throw new Error("Task definition exceeds the one-megabyte storage limit.");
    const projectId = await this.projectId();
    if (draft.originatingConversationId) await this.assertConversation(draft.originatingConversationId);
    for (const dependency of draft.taskDependencies ?? []) await this.assertTask(dependency);
    const taskId = id();
    const now = Date.now();
    const stepIds = draft.steps.map((step) => step.id ?? id());
    if (new Set(stepIds).size !== stepIds.length) throw new Error("Task step IDs must be unique.");
    const stepIdSet = new Set(stepIds);
    for (let index = 0; index < draft.steps.length; index += 1) {
      const step = draft.steps[index];
      if (!step.name.trim() || step.name.length > 240 || !step.purpose.trim() || step.purpose.length > 1e4) throw new Error("Task step name or purpose is invalid.");
      if (![0, 1, 2].includes(step.riskTier) || (step.requiredTool?.length ?? 0) > 200) throw new Error("Task step risk tier or required tool is invalid.");
      if (!Array.isArray(step.verificationCriteria) || step.verificationCriteria.length > 100 || step.verificationCriteria.some((criterion) => !criterion.trim() || criterion.length > 2e3)) throw new Error("Task step verification criteria are invalid.");
      for (const dependency of draft.steps[index].dependencies ?? []) if (!stepIdSet.has(dependency) || dependency === stepIds[index]) throw new Error("Task step dependency is invalid.");
    }
    this.assertAcyclicSteps(stepIds, draft.steps.map((step) => step.dependencies ?? []));
    this.ready().run(`INSERT INTO tasks (id, project_id, title, description, status, priority, created_at, updated_at, task_type, originating_conversation_id, last_active_conversation_id, assigned_provider, assigned_model, progress_summary, resumability_state, resume_instructions, associated_branch, associated_commit_sha, associated_pull_request, associated_release_tag, associated_workflow_run, process_ids, external_resource_ids)
      VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'resumable', ?, ?, ?, ?, ?, ?, '[]', '[]')`, [taskId, projectId, draft.title.trim(), draft.description ?? null, draft.priority ?? "medium", now, now, draft.taskType.trim(), draft.originatingConversationId ?? null, draft.originatingConversationId ?? null, draft.assignedProvider ?? null, draft.assignedModel ?? null, draft.progressSummary ?? "Draft task created.", draft.resumeInstructions.trim(), draft.associatedBranch ?? null, draft.associatedCommitSha ?? null, draft.associatedPullRequest ?? null, draft.associatedReleaseTag ?? null, draft.associatedWorkflowRun ?? null]);
    for (const dependency of draft.taskDependencies ?? []) this.ready().run("INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)", [taskId, dependency]);
    for (let index = 0; index < draft.steps.length; index += 1) {
      const step = draft.steps[index];
      const stepId = stepIds[index];
      const retryPolicy = { maxAttempts: Math.max(1, step.retryPolicy?.maxAttempts ?? 1), backoffMs: Math.max(0, step.retryPolicy?.backoffMs ?? 0), retryableErrorCodes: step.retryPolicy?.retryableErrorCodes ?? [] };
      this.insertTaskStep(taskId, stepId, index, step, retryPolicy);
      for (const dependency of step.dependencies ?? []) this.ready().run("INSERT INTO task_step_dependencies (task_id, step_id, depends_on_step_id) VALUES (?, ?, ?)", [taskId, stepId, dependency]);
    }
    this.appendTaskEventRow(taskId, void 0, "task.created", "Workspace-owned task created in draft state.", { taskType: draft.taskType });
    await this.persist();
    return this.getPersistentTask(taskId);
  }
  async listPersistentTasks(limit = 100) {
    const projectId = await this.projectId();
    return this.all("SELECT * FROM tasks WHERE project_id = ? ORDER BY updated_at DESC, created_at DESC LIMIT ?", [projectId, Math.min(Math.max(limit, 1), 500)]).map((row) => this.taskFromRow(row));
  }
  async getPersistentTask(taskId) {
    const row = await this.assertTask(taskId);
    return this.taskFromRow(row);
  }
  async updatePersistentTask(taskId, draft) {
    draft = normalizeTaskDraft(draft);
    await this.assertTask(taskId);
    if (!draft.title.trim()) throw new Error("Task title is required.");
    if (!draft.taskType.trim()) throw new Error("Task type is required.");
    if (!draft.resumeInstructions.trim()) throw new Error("Resume instructions are required.");
    if (!draft.steps.length) throw new Error("At least one step is required.");
    if (draft.steps.some((step) => !step.name.trim() || !step.purpose.trim() || !step.verificationCriteria.length)) throw new Error("Each step needs a name, purpose, and verification criterion.");
    const stepIds = draft.steps.map((step) => step.id ?? id());
    if (new Set(stepIds).size !== stepIds.length) throw new Error("Task step IDs must be unique.");
    const stepIdSet = new Set(stepIds);
    for (let index = 0; index < draft.steps.length; index += 1) {
      const step = draft.steps[index];
      if (![0, 1, 2].includes(step.riskTier) || step.dependencies?.some((dependency) => !stepIdSet.has(dependency) || dependency === stepIds[index])) throw new Error("Task step dependency or risk tier is invalid.");
    }
    this.assertAcyclicSteps(stepIds, draft.steps.map((step) => step.dependencies ?? []));
    const projectId = await this.projectId();
    const now = Date.now();
    this.ready().run(`UPDATE tasks SET title = ?, description = ?, task_type = ?, priority = ?, resume_instructions = ?, associated_branch = ?, progress_summary = ?, updated_at = ? WHERE id = ? AND project_id = ?`, [draft.title.trim(), draft.description ?? null, draft.taskType.trim(), draft.priority ?? "medium", draft.resumeInstructions.trim(), draft.associatedBranch ?? null, draft.progressSummary ?? "Task definition updated.", now, taskId, projectId]);
    this.ready().run("DELETE FROM task_step_dependencies WHERE task_id = ?", [taskId]);
    this.ready().run("DELETE FROM task_steps WHERE task_id = ?", [taskId]);
    for (let index = 0; index < draft.steps.length; index += 1) {
      const step = draft.steps[index];
      const stepId = stepIds[index];
      const retryPolicy = { maxAttempts: Math.max(1, step.retryPolicy?.maxAttempts ?? 1), backoffMs: Math.max(0, step.retryPolicy?.backoffMs ?? 0), retryableErrorCodes: step.retryPolicy?.retryableErrorCodes ?? [] };
      this.insertTaskStep(taskId, stepId, index, step, retryPolicy);
      for (const dependency of step.dependencies ?? []) this.ready().run("INSERT INTO task_step_dependencies (task_id, step_id, depends_on_step_id) VALUES (?, ?, ?)", [taskId, stepId, dependency]);
    }
    this.appendTaskEventRow(taskId, void 0, "state.reconciled", "Task definition edited and saved.", { fields: ["title", "description", "taskType", "priority", "resumeInstructions", "steps"] });
    await this.persist();
    return this.getPersistentTask(taskId);
  }
  async setPersistentTaskState(taskId, status, options) {
    if (!TASK_STATUSES.has(status)) throw new Error("Task status is invalid.");
    const row = await this.assertTask(taskId);
    const now = Date.now();
    if (options.lastActiveConversationId) await this.assertConversation(options.lastActiveConversationId);
    const startedAt = status === "running" && row.started_at === null ? now : row.started_at;
    const completedAt = status === "completed" ? now : null;
    this.ready().run(`UPDATE tasks SET status = ?, current_step_id = ?, updated_at = ?, started_at = ?, completed_at = ?, last_active_conversation_id = COALESCE(?, last_active_conversation_id), progress_summary = ?, interruption_reason = ?, resumability_state = COALESCE(?, resumability_state) WHERE id = ? AND project_id = ?`, [status, options.currentStepId === void 0 ? row.current_step_id : options.currentStepId, now, startedAt, completedAt, options.lastActiveConversationId ?? null, options.summary, options.interruptionReason ?? null, options.resumabilityState ?? null, taskId, await this.projectId()]);
    this.appendTaskEventRow(taskId, options.currentStepId ?? void 0, options.eventType, options.summary, options.details, options.auditReference);
    await this.persist();
    return this.getPersistentTask(taskId);
  }
  async setTaskStepState(taskId, stepId, status, options) {
    if (!STEP_STATUSES.has(status)) throw new Error("Task step status is invalid.");
    const row = await this.assertTaskStep(taskId, stepId);
    const now = Date.now();
    const startedAt = status === "pending" ? null : now;
    const completedAt = ["completed", "skipped"].includes(status) ? now : null;
    const externalProcessId = options.externalProcessId === void 0 ? row.external_process_id : options.externalProcessId;
    const outputPath = options.outputPath === void 0 ? row.output_path : options.outputPath;
    this.ready().run(`UPDATE task_steps SET status = ?, started_at = COALESCE(started_at, ?), completed_at = ?, attempts = attempts + ?, last_error = ?, external_process_id = ?, output_path = ? WHERE id = ? AND task_id = ?`, [status, startedAt, completedAt, options.incrementAttempts ? 1 : 0, options.error ? JSON.stringify(sanitizeTaskData(options.error)) : null, externalProcessId, outputPath, stepId, taskId]);
    this.ready().run("UPDATE tasks SET current_step_id = ?, updated_at = ?, progress_summary = ? WHERE id = ?", [stepId, now, options.summary, taskId]);
    const eventType = options.eventType ?? (status === "completed" ? "step.completed" : status === "failed" ? "step.failed" : status === "waiting" ? "step.waiting" : status === "running" ? "step.started" : "state.reconciled");
    this.appendTaskEventRow(taskId, stepId, eventType, options.summary, options.error, options.auditReference);
    await this.persist();
    return this.getPersistentTask(taskId);
  }
  async appendTaskCheckpoint(taskId, checkpoint) {
    await this.assertTask(taskId);
    if (checkpoint.stepId) await this.assertTaskStep(taskId, checkpoint.stepId);
    const projectId = await this.projectId();
    for (const reference of checkpoint.auditReferences ?? []) if (!this.one("SELECT id FROM action_log WHERE id = ? AND project_id = ?", [reference, projectId])) throw new Error("Task checkpoint audit reference does not exist in the active workspace.");
    const value = { id: id(), taskId, stepId: checkpoint.stepId, name: checkpoint.name, summary: checkpoint.summary, verified: checkpoint.verified, evidence: sanitizeTaskData(checkpoint.evidence ?? null), auditReferences: checkpoint.auditReferences ?? [], createdAt: Date.now() };
    this.ready().run("INSERT INTO task_checkpoints VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [value.id, projectId, taskId, value.stepId ?? null, value.name, value.summary, value.verified ? 1 : 0, JSON.stringify(value.evidence), JSON.stringify(value.auditReferences), value.createdAt]);
    await this.persist();
    return value;
  }
  async appendTaskEvent(taskId, event) {
    await this.assertTask(taskId);
    if (event.stepId) await this.assertTaskStep(taskId, event.stepId);
    const eventId = id();
    const createdAt = Date.now();
    const projectId = await this.projectId();
    this.ready().run("INSERT INTO task_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [eventId, projectId, taskId, event.stepId ?? null, event.type, event.summary, event.details === void 0 ? null : JSON.stringify(sanitizeTaskData(event.details)), event.auditReference ?? null, createdAt]);
    await this.persist();
    return { id: eventId, taskId, stepId: event.stepId, type: event.type, summary: event.summary, details: sanitizeTaskData(event.details), auditReference: event.auditReference, createdAt };
  }
  async updateTaskReality(taskId, reality) {
    await this.assertTask(taskId);
    const projectId = await this.projectId();
    this.ready().run(`UPDATE tasks SET associated_branch = COALESCE(?, associated_branch), associated_commit_sha = COALESCE(?, associated_commit_sha), process_ids = COALESCE(?, process_ids), external_resource_ids = COALESCE(?, external_resource_ids), updated_at = ? WHERE id = ? AND project_id = ?`, [reality.associatedBranch ?? null, reality.associatedCommitSha ?? null, reality.processIds ? JSON.stringify(reality.processIds) : null, reality.externalResourceIds ? JSON.stringify(reality.externalResourceIds) : null, Date.now(), taskId, projectId]);
    await this.persist();
  }
  async linkTaskStepAudit(taskId, stepId, auditReference) {
    const row = await this.assertTaskStep(taskId, stepId);
    const projectId = await this.projectId();
    if (!this.one("SELECT id FROM action_log WHERE id = ? AND project_id = ?", [auditReference, projectId])) throw new Error("Task step audit reference does not exist in the active workspace.");
    const references = parseJson(row.audit_references, []);
    if (!references.includes(auditReference)) references.push(auditReference);
    this.ready().run("UPDATE task_steps SET audit_references = ? WHERE id = ? AND task_id = ?", [JSON.stringify(references), stepId, taskId]);
    await this.persist();
  }
  async appendTaskArtifact(taskId, artifact) {
    await this.assertTask(taskId);
    if (artifact.stepId) await this.assertTaskStep(taskId, artifact.stepId);
    const value = { ...artifact, id: id(), taskId, metadata: sanitizeTaskData(artifact.metadata), createdAt: Date.now() };
    this.ready().run("INSERT INTO task_artifacts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [value.id, await this.projectId(), taskId, value.stepId ?? null, value.kind, value.path ?? null, value.uri ?? null, value.sha256 ?? null, value.size ?? null, value.verifiedAt ?? null, value.metadata === void 0 ? null : JSON.stringify(value.metadata), value.createdAt]);
    await this.persist();
    return value;
  }
  async upsertTaskExternalReference(taskId, reference) {
    await this.assertTask(taskId);
    if (reference.stepId) await this.assertTaskStep(taskId, reference.stepId);
    const projectId = await this.projectId();
    const existing = this.one("SELECT id, created_at FROM task_external_references WHERE task_id = ? AND type = ? AND external_id = ?", [taskId, reference.type, reference.externalId]);
    const now = Date.now();
    const value = { ...reference, id: existing ? String(existing.id) : id(), taskId, metadata: sanitizeTaskData(reference.metadata), createdAt: existing ? Number(existing.created_at) : now, updatedAt: now };
    this.ready().run(`INSERT INTO task_external_references (id, project_id, task_id, step_id, type, provider, external_id, url, state, metadata, verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(task_id, type, external_id) DO UPDATE SET step_id = excluded.step_id, provider = excluded.provider, url = excluded.url, state = excluded.state, metadata = excluded.metadata, verified_at = excluded.verified_at, updated_at = excluded.updated_at`, [value.id, projectId, taskId, value.stepId ?? null, value.type, value.provider ?? null, value.externalId, value.url ?? null, value.state ?? null, value.metadata === void 0 ? null : JSON.stringify(value.metadata), value.verifiedAt ?? null, value.createdAt, value.updatedAt]);
    await this.persist();
    return value;
  }
  async deleteConversation(conversationId) {
    const validId = await this.assertConversation(conversationId);
    const projectId = await this.projectId();
    this.ready().run("DELETE FROM conversations WHERE thread_id = ? AND project_id = ?", [validId, projectId]);
    this.ready().run("DELETE FROM conversation_threads WHERE id = ? AND project_id = ?", [validId, projectId]);
    this.ready().run("UPDATE workspace_state SET active_conversation_id = NULL, updated_at = ? WHERE project_id = ? AND active_conversation_id = ?", [Date.now(), projectId, validId]);
    await this.persist();
    return this.conversationState();
  }
  async clearAllConversations() {
    const projectId = await this.projectId();
    this.ready().run("DELETE FROM conversations WHERE project_id = ?", [projectId]);
    this.ready().run("DELETE FROM conversation_threads WHERE project_id = ?", [projectId]);
    this.ready().run("UPDATE workspace_state SET active_conversation_id = NULL, updated_at = ? WHERE project_id = ?", [Date.now(), projectId]);
    await this.persist();
    return this.conversationState();
  }
  async conversationState(conversationId) {
    const activeConversationId = conversationId ? await this.assertConversation(conversationId) : await this.ensureActiveConversation();
    return {
      activeConversationId,
      threads: await this.listConversationThreads(),
      messages: await this.listConversationMessages(activeConversationId)
    };
  }
  async createConversation(title) {
    const projectId = await this.projectId();
    const conversationId = id();
    const now = Date.now();
    this.ready().run("INSERT INTO conversation_threads VALUES (?, ?, ?, ?, ?)", [conversationId, projectId, normalizeTitle(title), now, now]);
    this.setWorkspaceState(projectId, conversationId);
    await this.persist();
    return this.conversationState(conversationId);
  }
  async selectConversation(conversationId) {
    const validId = await this.assertConversation(conversationId);
    this.setWorkspaceState(await this.projectId(), validId);
    await this.persist();
    return this.conversationState(validId);
  }
  async renameConversation(conversationId, title) {
    const validId = await this.assertConversation(conversationId);
    const normalized = normalizeTitle(title);
    if (normalized === "New conversation" && !title.trim()) throw new Error("Conversation title is required.");
    this.ready().run("UPDATE conversation_threads SET title = ?, updated_at = ? WHERE id = ?", [normalized, Date.now(), validId]);
    await this.persist();
    return this.conversationState(validId);
  }
  async clearConversation(conversationId) {
    const validId = await this.assertConversation(conversationId);
    this.ready().run("DELETE FROM conversations WHERE thread_id = ?", [validId]);
    this.ready().run("UPDATE conversation_threads SET updated_at = ? WHERE id = ?", [Date.now(), validId]);
    await this.persist();
    return this.conversationState(validId);
  }
  async appendConversation(conversationId, role, content) {
    const validId = await this.assertConversation(conversationId);
    if (role !== "user" && role !== "assistant") throw new Error("Conversation role is invalid.");
    if (!content.trim()) throw new Error("Conversation content is required.");
    const projectId = await this.projectId();
    const now = Date.now();
    const entry = { id: id(), conversationId: validId, role, content, createdAt: now };
    this.ready().run("INSERT INTO conversations (id, project_id, thread_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)", [entry.id, projectId, validId, role, content, now]);
    const thread = this.one("SELECT title FROM conversation_threads WHERE id = ?", [validId]);
    const messageCount = Number(this.one("SELECT COUNT(*) AS count FROM conversations WHERE thread_id = ?", [validId])?.count ?? 0);
    const nextTitle = role === "user" && messageCount === 1 && String(thread?.title ?? "") === "New conversation" ? titleFromPrompt(content) : String(thread?.title ?? "New conversation");
    this.ready().run("UPDATE conversation_threads SET title = ?, updated_at = ? WHERE id = ?", [nextTitle, now, validId]);
    await this.persist();
    return entry;
  }
  async listConversationMessages(conversationId, limit = 200) {
    const validId = await this.assertConversation(conversationId);
    return this.all(`SELECT id, thread_id, role, content, created_at FROM (
      SELECT id, thread_id, role, content, created_at FROM conversations
      WHERE thread_id = ? ORDER BY created_at DESC, id DESC LIMIT ?
    ) ORDER BY created_at ASC, id ASC`, [validId, limit]).map((row) => ({
      id: String(row.id),
      conversationId: String(row.thread_id),
      role: String(row.role),
      content: String(row.content),
      createdAt: Number(row.created_at)
    }));
  }
  async listConversationThreads() {
    const projectId = await this.projectId();
    return this.all(`SELECT t.id, t.title, t.created_at, t.updated_at, COUNT(m.id) AS message_count
      FROM conversation_threads t LEFT JOIN conversations m ON m.thread_id = t.id
      WHERE t.project_id = ? GROUP BY t.id ORDER BY t.updated_at DESC, t.created_at DESC`, [projectId]).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      messageCount: Number(row.message_count)
    }));
  }
  async getWorkspaceLayout() {
    const projectId = await this.projectId();
    const raw = this.one("SELECT layout_json FROM workspace_state WHERE project_id = ?", [projectId])?.layout_json;
    if (!raw) return { ...DEFAULT_WORKSPACE_LAYOUT };
    try {
      return normalizeWorkspaceLayout(JSON.parse(String(raw)));
    } catch {
      return { ...DEFAULT_WORKSPACE_LAYOUT };
    }
  }
  async saveWorkspaceLayout(layout) {
    const projectId = await this.projectId();
    const normalized = normalizeWorkspaceLayout(layout);
    this.ready().run(
      `INSERT INTO workspace_state (project_id, active_conversation_id, layout_json, updated_at)
      VALUES (?, NULL, ?, ?) ON CONFLICT(project_id) DO UPDATE SET layout_json = excluded.layout_json, updated_at = excluded.updated_at`,
      [projectId, JSON.stringify(normalized), Date.now()]
    );
    await this.persist();
    return normalized;
  }
  async createMemory(type, title, content, metadata) {
    if (content.length > MAX_MEMORY_CONTENT_CHARS) throw new Error(`Memory content exceeds the ${MAX_MEMORY_CONTENT_CHARS.toLocaleString()} character safety limit.`);
    const serializedMetadata = metadata === void 0 ? null : JSON.stringify(metadata);
    if ((serializedMetadata?.length ?? 0) > MAX_MEMORY_METADATA_CHARS) throw new Error("Memory metadata exceeds the storage safety limit.");
    const projectId = await this.projectId();
    const now = Date.now();
    const memoryId = id();
    this.ready().run("INSERT INTO memories VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [memoryId, projectId, type, title ?? null, content, serializedMetadata, now, now]);
    await this.persist();
    return { id: memoryId, type, title, content, metadata, createdAt: now, updatedAt: now };
  }
  async listMemories(limit = 100, contentLimit = 12e3) {
    const projectId = await this.projectId();
    const boundedLimit = Math.max(0, Math.min(24e3, Math.floor(contentLimit)));
    return this.all("SELECT id, type, title, substr(content, 1, ?) AS content, length(content) AS content_length, metadata, created_at, updated_at FROM memories WHERE project_id = ? ORDER BY created_at DESC LIMIT ?", [boundedLimit, projectId, Math.max(1, Math.min(2e3, Math.floor(limit)))]).map((row) => ({
      id: String(row.id),
      type: String(row.type),
      title: row.title ? String(row.title) : null,
      content: String(row.content),
      contentLength: Number(row.content_length),
      metadata: parseJson(row.metadata, void 0),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at)
    }));
  }
  async memoryStats() {
    const projectId = await this.projectId();
    const records = this.all("SELECT metadata, length(content) AS content_length FROM memories WHERE project_id = ?", [projectId]);
    const indexedCount = records.filter((record) => parseJson(record.metadata, void 0)?.origin === "workspace-index").length;
    const lengths = records.map((record) => Number(record.content_length) || 0);
    return { recordCount: records.length, indexedCount, durableCount: records.length - indexedCount, totalContentChars: lengths.reduce((sum, length) => sum + length, 0), largestContentChars: Math.max(0, ...lengths) };
  }
  async updateMemory(memoryId, fields) {
    const projectId = await this.projectId();
    const set = [];
    const params = [];
    if (fields.type !== void 0) {
      set.push("type = ?");
      params.push(fields.type);
    }
    if (fields.title !== void 0) {
      set.push("title = ?");
      params.push(fields.title);
    }
    if (fields.content !== void 0) {
      if (fields.content.length > MAX_MEMORY_CONTENT_CHARS) throw new Error(`Memory content exceeds the ${MAX_MEMORY_CONTENT_CHARS.toLocaleString()} character safety limit.`);
      set.push("content = ?");
      params.push(fields.content);
    }
    if (fields.metadata !== void 0) {
      const serializedMetadata = fields.metadata ? JSON.stringify(fields.metadata) : null;
      if ((serializedMetadata?.length ?? 0) > MAX_MEMORY_METADATA_CHARS) throw new Error("Memory metadata exceeds the storage safety limit.");
      set.push("metadata = ?");
      params.push(serializedMetadata);
    }
    if (!set.length) return;
    params.push(Date.now(), memoryId, projectId);
    this.ready().run(`UPDATE memories SET ${set.join(", ")}, updated_at = ? WHERE id = ? AND project_id = ?`, params);
    await this.persist();
  }
  async deleteMemory(memoryId) {
    this.ready().run("DELETE FROM memories WHERE id = ? AND project_id = ?", [memoryId, await this.projectId()]);
    await this.persist();
  }
  async clearMemories() {
    const projectId = await this.projectId();
    const deleted = Number(this.one("SELECT COUNT(*) AS count FROM memories WHERE project_id = ?", [projectId])?.count ?? 0);
    this.ready().run("DELETE FROM memories WHERE project_id = ?", [projectId]);
    await this.persist();
    return { deleted };
  }
  async deletePersistentTask(taskId) {
    await this.assertTask(taskId);
    const projectId = await this.projectId();
    this.ready().run("DELETE FROM task_dependencies WHERE task_id = ? OR depends_on_task_id = ?", [taskId, taskId]);
    this.ready().run("DELETE FROM tasks WHERE id = ? AND project_id = ?", [taskId, projectId]);
    await this.persist();
  }
  async listBrowserBookmarks(limit = 80) {
    const projectId = await this.projectId();
    return this.all("SELECT id, url, title, created_at FROM browser_bookmarks WHERE project_id = ? ORDER BY created_at DESC LIMIT ?", [projectId, Math.max(1, Math.min(200, limit))]).map((row) => ({ id: String(row.id), url: String(row.url), title: String(row.title), createdAt: Number(row.created_at) }));
  }
  async addBrowserBookmark(url, title) {
    const projectId = await this.projectId();
    const now = Date.now();
    this.ready().run(`INSERT INTO browser_bookmarks (id, project_id, url, title, created_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(project_id, url) DO UPDATE SET title = excluded.title, created_at = excluded.created_at`, [id(), projectId, url, title.slice(0, 500) || url, now]);
    await this.persist();
  }
  async deleteBrowserBookmark(bookmarkId) {
    this.ready().run("DELETE FROM browser_bookmarks WHERE id = ? AND project_id = ?", [bookmarkId, await this.projectId()]);
    await this.persist();
  }
  async listBrowserHistory(limit = 120) {
    const projectId = await this.projectId();
    return this.all("SELECT id, url, title, visited_at, visit_count FROM browser_history WHERE project_id = ? ORDER BY visited_at DESC LIMIT ?", [projectId, Math.max(1, Math.min(300, limit))]).map((row) => ({ id: String(row.id), url: String(row.url), title: String(row.title), visitedAt: Number(row.visited_at), visitCount: Number(row.visit_count) }));
  }
  async recordBrowserVisit(url, title) {
    const projectId = await this.projectId();
    const now = Date.now();
    this.ready().run(`INSERT INTO browser_history (id, project_id, url, title, visited_at, visit_count) VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(project_id, url) DO UPDATE SET title = excluded.title, visited_at = excluded.visited_at, visit_count = browser_history.visit_count + 1`, [id(), projectId, url, title.slice(0, 500) || url, now]);
    await this.persist();
  }
  async workspaceId() {
    return this.projectId();
  }
  /** Durable, bounded project observations used to invalidate stale context. */
  async recordProjectObservation(kind, payload) {
    if (!/^[a-z]+(?:[.-][a-z]+)+$/.test(kind)) throw new Error("Project observation kind is invalid.");
    const workspaceId = await this.projectId();
    const timestamp = Date.now();
    const observation = { id: id(), workspaceId, kind, timestamp, payload: sanitizeTaskData(payload) };
    this.ready().run("BEGIN");
    try {
      this.ready().run("INSERT INTO project_observations (id, project_id, kind, timestamp, payload) VALUES (?, ?, ?, ?, ?)", [observation.id, workspaceId, kind, timestamp, JSON.stringify(observation.payload)]);
      this.ready().run(`DELETE FROM project_observations WHERE project_id = ? AND id NOT IN (
        SELECT id FROM project_observations WHERE project_id = ? ORDER BY timestamp DESC, id DESC LIMIT ?
      )`, [workspaceId, workspaceId, MAX_PROJECT_OBSERVATIONS]);
      this.ready().run(`INSERT INTO project_context_state (project_id, invalidated_at, invalidation_reasons, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(project_id) DO UPDATE SET invalidated_at = excluded.invalidated_at, invalidation_reasons = excluded.invalidation_reasons, updated_at = excluded.updated_at`, [workspaceId, timestamp, JSON.stringify([kind]), timestamp]);
      this.ready().run("UPDATE projects SET updated_at = ? WHERE id = ?", [timestamp, workspaceId]);
      this.ready().run("COMMIT");
    } catch (error) {
      this.ready().run("ROLLBACK");
      throw error;
    }
    await this.persist();
    return observation;
  }
  async listProjectObservations(limit = 40) {
    const workspaceId = await this.projectId();
    return this.all("SELECT * FROM project_observations WHERE project_id = ? ORDER BY timestamp DESC LIMIT ?", [workspaceId, Math.min(Math.max(limit, 1), 200)]).map((row) => ({ id: String(row.id), workspaceId: String(row.project_id), kind: String(row.kind), timestamp: Number(row.timestamp), payload: parseJson(row.payload, null) }));
  }
  async semanticRecords(options = {}) {
    const clauses = ["project_id = ?"];
    const params = [await this.projectId()];
    if (options.sourceType) {
      clauses.push("source_type = ?");
      params.push(options.sourceType);
    }
    if (options.sourceId) {
      clauses.push("source_id = ?");
      params.push(options.sourceId);
    }
    if (options.embeddingModel) {
      clauses.push("embedding_model = ?");
      params.push(options.embeddingModel);
    }
    if (!options.includeSuperseded) clauses.push("lifecycle != 'superseded'");
    params.push(Math.min(Math.max(options.limit ?? 2e3, 1), 5e3));
    return this.all(`SELECT * FROM semantic_records WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC LIMIT ?`, params).map((row) => this.semanticRecordFromRow(row));
  }
  /**
   * sql.js exports the complete in-memory database for every persistence call.
   * Semantic indexing can write hundreds of chunks, so those writes must share
   * one export instead of multiplying database-sized ArrayBuffer allocations.
   */
  async withSemanticWriteBatch(operation) {
    this.semanticWriteBatchDepth += 1;
    try {
      return await operation();
    } finally {
      this.semanticWriteBatchDepth -= 1;
      if (this.semanticWriteBatchDepth === 0 && this.semanticWriteDirty) {
        await this.persist();
        this.semanticWriteDirty = false;
      }
    }
  }
  async upsertSemanticRecord(input) {
    const projectId = await this.projectId();
    const now = Date.now();
    const identical = this.one("SELECT * FROM semantic_records WHERE project_id = ? AND source_type = ? AND source_id = ? AND chunk_index = ? AND content_hash = ? AND embedding_model = ?", [projectId, input.sourceType, input.sourceId, input.chunkIndex, input.contentHash, input.embeddingModel]);
    if (identical) {
      this.ready().run("UPDATE semantic_records SET source_uri = ?, source_revision = ?, line_start = ?, line_end = ?, last_verified_at = ?, authority_score = ?, lifecycle = CASE WHEN lifecycle = 'superseded' THEN 'active' ELSE lifecycle END, metadata_json = ? WHERE id = ?", [input.sourceUri ?? null, input.sourceRevision, input.lineStart ?? null, input.lineEnd ?? null, now, input.authorityScore, JSON.stringify(sanitizeTaskData(input.metadata)), String(identical.id)]);
      await this.persistSemanticMutation();
      return { record: this.semanticRecordFromRow(this.one("SELECT * FROM semantic_records WHERE id = ?", [String(identical.id)])), embedded: false };
    }
    const recordId = input.id || id();
    this.ready().run(`INSERT INTO semantic_records (id, project_id, source_type, source_id, source_uri, source_revision, chunk_index, line_start, line_end, content_hash, text, embedding_json, embedding_blob, embedding_model, embedding_dimensions, created_at, updated_at, last_verified_at, last_used_at, usage_count, authority_score, lifecycle, superseded_by, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [recordId, projectId, input.sourceType, input.sourceId, input.sourceUri ?? null, input.sourceRevision, input.chunkIndex, input.lineStart ?? null, input.lineEnd ?? null, input.contentHash, input.text, embeddingBytes(input.embedding), input.embeddingModel, input.embeddingDimensions, input.createdAt ?? now, input.updatedAt ?? now, input.lastVerifiedAt ?? now, input.lastUsedAt ?? null, input.usageCount ?? 0, input.authorityScore, input.lifecycle, input.supersededBy ?? null, JSON.stringify(sanitizeTaskData(input.metadata))]);
    await this.persistSemanticMutation();
    return { record: this.semanticRecordFromRow(this.one("SELECT * FROM semantic_records WHERE id = ?", [recordId])), embedded: true };
  }
  async supersedeSemanticSource(sourceType, sourceId, sourceRevision, replacementIds) {
    const projectId = await this.projectId();
    const current = this.all("SELECT id FROM semantic_records WHERE project_id = ? AND source_type = ? AND source_id = ? AND source_revision != ? AND lifecycle != 'superseded'", [projectId, sourceType, sourceId, sourceRevision]);
    for (const row of current) this.ready().run("UPDATE semantic_records SET lifecycle = 'superseded', superseded_by = ?, updated_at = ? WHERE id = ?", [replacementIds[0] ?? null, Date.now(), String(row.id)]);
    if (current.length) await this.persistSemanticMutation();
    return current.length;
  }
  async supersedeSemanticSourcesMissing(sourceTypes, sourceIds) {
    if (!sourceTypes.length) return 0;
    const projectId = await this.projectId();
    const typePlaceholders = sourceTypes.map(() => "?").join(", ");
    const present = new Set(sourceIds);
    const rows = this.all(`SELECT DISTINCT source_type, source_id FROM semantic_records WHERE project_id = ? AND source_type IN (${typePlaceholders}) AND lifecycle != 'superseded'`, [projectId, ...sourceTypes]);
    let changed = 0;
    for (const row of rows) {
      if (present.has(String(row.source_id))) continue;
      this.ready().run("UPDATE semantic_records SET lifecycle = 'superseded', superseded_by = NULL, updated_at = ? WHERE project_id = ? AND source_type = ? AND source_id = ? AND lifecycle != 'superseded'", [Date.now(), projectId, String(row.source_type), String(row.source_id)]);
      changed += this.ready().getRowsModified();
    }
    if (changed) await this.persistSemanticMutation();
    return changed;
  }
  async updateSemanticLifecycle(now = Date.now()) {
    const projectId = await this.projectId();
    this.ready().run("UPDATE semantic_records SET lifecycle = CASE WHEN lifecycle IN ('superseded','archived') THEN lifecycle WHEN ? - last_verified_at > 15552000000 THEN 'stale' WHEN ? - last_verified_at > 5184000000 THEN 'aging' ELSE 'active' END WHERE project_id = ?", [now, now, projectId]);
    const changed = this.ready().getRowsModified();
    if (changed) await this.persistSemanticMutation();
    return changed;
  }
  async pruneSupersededSemanticRecords(retain = 100) {
    const projectId = await this.projectId();
    const boundedRetain = Math.min(1e3, Math.max(0, Math.round(retain)));
    this.ready().run(`DELETE FROM semantic_records WHERE project_id = ? AND lifecycle = 'superseded' AND id NOT IN (
      SELECT id FROM semantic_records WHERE project_id = ? AND lifecycle = 'superseded' ORDER BY updated_at DESC, id DESC LIMIT ?
    )`, [projectId, projectId, boundedRetain]);
    const changed = this.ready().getRowsModified();
    if (changed) await this.persistSemanticMutation();
    return changed;
  }
  async markSemanticRecordsUsed(ids, successful = false) {
    if (!ids.length) return;
    const projectId = await this.projectId();
    const increment = successful ? 2 : 1;
    for (const recordId of [...new Set(ids)]) this.ready().run("UPDATE semantic_records SET last_used_at = ?, usage_count = MIN(1000, usage_count + ?) WHERE id = ? AND project_id = ?", [Date.now(), increment, recordId, projectId]);
    await this.persistSemanticMutation();
  }
  async clearSemanticIndex() {
    const projectId = await this.projectId();
    const count = Number(this.one("SELECT COUNT(*) AS count FROM semantic_records WHERE project_id = ?", [projectId])?.count ?? 0);
    this.ready().run("DELETE FROM semantic_records WHERE project_id = ?", [projectId]);
    this.ready().run("INSERT INTO semantic_index_state (project_id, state, indexed_records, active_records, stale_records, updated_at) VALUES (?, 'empty', 0, 0, 0, ?) ON CONFLICT(project_id) DO UPDATE SET state = 'empty', embedding_model = NULL, embedding_dimensions = NULL, indexed_records = 0, active_records = 0, stale_records = 0, last_indexed_at = NULL, last_error = NULL, updated_at = excluded.updated_at", [projectId, Date.now()]);
    await this.persistSemanticMutation();
    return { deleted: count };
  }
  async setSemanticIndexState(update) {
    const projectId = await this.projectId();
    const counts = this.one("SELECT COUNT(*) AS total, SUM(CASE WHEN lifecycle IN ('active','aging') THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN lifecycle = 'stale' THEN 1 ELSE 0 END) AS stale FROM semantic_records WHERE project_id = ?", [projectId]);
    this.ready().run(`INSERT INTO semantic_index_state (project_id, state, embedding_model, embedding_dimensions, indexed_records, active_records, stale_records, last_indexed_at, last_error, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET state = excluded.state, embedding_model = COALESCE(excluded.embedding_model, embedding_model), embedding_dimensions = COALESCE(excluded.embedding_dimensions, embedding_dimensions), indexed_records = excluded.indexed_records, active_records = excluded.active_records, stale_records = excluded.stale_records, last_indexed_at = COALESCE(excluded.last_indexed_at, last_indexed_at), last_error = excluded.last_error, updated_at = excluded.updated_at`, [projectId, update.state, update.embeddingModel ?? null, update.embeddingDimensions ?? null, Number(counts?.total ?? 0), Number(counts?.active ?? 0), Number(counts?.stale ?? 0), update.lastIndexedAt ?? null, update.lastError ?? null, Date.now()]);
    await this.persistSemanticMutation();
    return this.semanticIndexStatus();
  }
  async semanticIndexStatus() {
    const projectId = await this.projectId();
    const row = this.one("SELECT * FROM semantic_index_state WHERE project_id = ?", [projectId]);
    if (!row) return { schemaVersion: CURRENT_SCHEMA_VERSION, state: "empty", indexedRecords: 0, activeRecords: 0, staleRecords: 0 };
    return { schemaVersion: CURRENT_SCHEMA_VERSION, state: String(row.state), embeddingModel: row.embedding_model ? String(row.embedding_model) : void 0, embeddingDimensions: row.embedding_dimensions === null ? void 0 : Number(row.embedding_dimensions), indexedRecords: Number(row.indexed_records), activeRecords: Number(row.active_records), staleRecords: Number(row.stale_records), lastIndexedAt: row.last_indexed_at === null ? void 0 : Number(row.last_indexed_at), lastError: row.last_error ? String(row.last_error) : void 0 };
  }
  async appendAction(record) {
    const projectId = await this.projectId();
    if (record.workspaceId !== projectId) throw new Error("Audit record belongs to another workspace.");
    this.ready().run(`INSERT INTO action_log (id, project_id, timestamp, conversation_id, model_id, tool_name, task_id, step_id, sanitized_inputs, execution_state, execution_duration_ms, success, result_json, result_summary, affected_paths, exit_code, rollback)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [record.id, projectId, record.timestamp, record.conversationId, record.modelId, record.toolName, record.taskId ?? null, record.stepId ?? null, JSON.stringify(record.sanitizedInputs ?? null), record.executionState, record.executionDurationMs, record.success ? 1 : 0, JSON.stringify(record.result ?? null), record.resultSummary, JSON.stringify(record.affectedPaths), record.exitCode ?? null, record.rollback ? JSON.stringify(record.rollback) : null]);
    await this.persist();
  }
  async listActions(filters = {}) {
    const clauses = ["project_id = ?"];
    const params = [await this.projectId()];
    if (filters.conversationId) {
      clauses.push("conversation_id = ?");
      params.push(filters.conversationId);
    }
    if (filters.toolName) {
      clauses.push("tool_name = ?");
      params.push(filters.toolName);
    }
    if (filters.success !== void 0) {
      clauses.push("success = ?");
      params.push(filters.success ? 1 : 0);
    }
    if (filters.from !== void 0) {
      clauses.push("timestamp >= ?");
      params.push(filters.from);
    }
    if (filters.to !== void 0) {
      clauses.push("timestamp <= ?");
      params.push(filters.to);
    }
    params.push(500);
    return this.all(`SELECT * FROM action_log WHERE ${clauses.join(" AND ")} ORDER BY timestamp DESC LIMIT ?`, params).map((row) => ({
      id: String(row.id),
      timestamp: Number(row.timestamp),
      workspaceId: String(row.project_id),
      conversationId: String(row.conversation_id),
      modelId: String(row.model_id),
      toolName: String(row.tool_name),
      taskId: row.task_id ? String(row.task_id) : void 0,
      stepId: row.step_id ? String(row.step_id) : void 0,
      sanitizedInputs: row.sanitized_inputs ? JSON.parse(String(row.sanitized_inputs)) : null,
      executionState: String(row.execution_state),
      executionDurationMs: Number(row.execution_duration_ms),
      success: Boolean(row.success),
      result: row.result_json ? JSON.parse(String(row.result_json)) : { success: Boolean(row.success) },
      resultSummary: String(row.result_summary),
      affectedPaths: row.affected_paths ? JSON.parse(String(row.affected_paths)) : [],
      exitCode: row.exit_code === null ? null : Number(row.exit_code),
      rollback: row.rollback ? JSON.parse(String(row.rollback)) : void 0
    }));
  }
  insertTaskStep(taskId, stepId, position, step, retryPolicy) {
    const columns = ["id", "task_id", "position", "name", "purpose", "status", "risk_tier", "required_tool", "expected_input", "expected_output", "attempts", "retry_policy", "timeout_ms", "artifact_paths", "verification_criteria", "rollback_instructions", "audit_references"];
    const values = [stepId, taskId, position, step.name.trim(), step.purpose.trim(), "pending", step.riskTier, step.requiredTool ?? null, JSON.stringify(sanitizeTaskData(step.expectedInput ?? null)), JSON.stringify(sanitizeTaskData(step.expectedOutput ?? null)), 0, JSON.stringify(retryPolicy), Math.max(100, step.timeoutMs ?? 12e4), JSON.stringify(step.artifactPaths ?? []), JSON.stringify(step.verificationCriteria), step.rollbackInstructions ?? null, "[]"];
    this.ready().run(`INSERT INTO task_steps (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`, values);
  }
  createSchema() {
    this.ready().run(`
      CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, root_path TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, status TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY(project_id) REFERENCES projects(id));
      CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, status TEXT NOT NULL, priority TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY(project_id) REFERENCES projects(id));
      CREATE TABLE IF NOT EXISTS conversation_threads (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY(project_id) REFERENCES projects(id));
      CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, thread_id TEXT, role TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL, FOREIGN KEY(project_id) REFERENCES projects(id));
      CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, type TEXT NOT NULL, title TEXT, content TEXT NOT NULL, metadata TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY(project_id) REFERENCES projects(id));
      CREATE TABLE IF NOT EXISTS workspace_state (project_id TEXT PRIMARY KEY, active_conversation_id TEXT, layout_json TEXT, updated_at INTEGER NOT NULL, FOREIGN KEY(project_id) REFERENCES projects(id));
      CREATE TABLE IF NOT EXISTS project_observations (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, kind TEXT NOT NULL, timestamp INTEGER NOT NULL, payload TEXT NOT NULL, FOREIGN KEY(project_id) REFERENCES projects(id));
      CREATE TABLE IF NOT EXISTS project_context_state (project_id TEXT PRIMARY KEY, invalidated_at INTEGER, invalidation_reasons TEXT NOT NULL DEFAULT '[]', updated_at INTEGER NOT NULL, FOREIGN KEY(project_id) REFERENCES projects(id));
      CREATE TABLE IF NOT EXISTS action_log (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, timestamp INTEGER NOT NULL, conversation_id TEXT NOT NULL, model_id TEXT NOT NULL, tool_name TEXT NOT NULL, task_id TEXT, step_id TEXT, sanitized_inputs TEXT NOT NULL, execution_state TEXT NOT NULL, execution_duration_ms INTEGER NOT NULL, success INTEGER NOT NULL, result_json TEXT NOT NULL DEFAULT '{}', result_summary TEXT NOT NULL, affected_paths TEXT NOT NULL, exit_code INTEGER, rollback TEXT, FOREIGN KEY(project_id) REFERENCES projects(id));
      CREATE TABLE IF NOT EXISTS browser_bookmarks (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, url TEXT NOT NULL, title TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(project_id, url), FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS browser_history (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, url TEXT NOT NULL, title TEXT NOT NULL, visited_at INTEGER NOT NULL, visit_count INTEGER NOT NULL DEFAULT 1, UNIQUE(project_id, url), FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS semantic_records (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL, source_uri TEXT, source_revision TEXT NOT NULL, chunk_index INTEGER NOT NULL, line_start INTEGER, line_end INTEGER, content_hash TEXT NOT NULL, text TEXT NOT NULL, embedding_json TEXT NOT NULL, embedding_blob BLOB, embedding_model TEXT NOT NULL, embedding_dimensions INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_verified_at INTEGER NOT NULL, last_used_at INTEGER, usage_count INTEGER NOT NULL DEFAULT 0, authority_score REAL NOT NULL DEFAULT 0.5, lifecycle TEXT NOT NULL DEFAULT 'active', superseded_by TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE, FOREIGN KEY(superseded_by) REFERENCES semantic_records(id) ON DELETE SET NULL, UNIQUE(project_id, source_type, source_id, chunk_index, content_hash, embedding_model));
      CREATE TABLE IF NOT EXISTS semantic_index_state (project_id TEXT PRIMARY KEY, state TEXT NOT NULL DEFAULT 'empty', embedding_model TEXT, embedding_dimensions INTEGER, indexed_records INTEGER NOT NULL DEFAULT 0, active_records INTEGER NOT NULL DEFAULT 0, stale_records INTEGER NOT NULL DEFAULT 0, last_indexed_at INTEGER, last_error TEXT, updated_at INTEGER NOT NULL, FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE);
    `);
    const columns = this.all("PRAGMA table_info(conversations)").map((row) => String(row.name));
    if (!columns.includes("thread_id")) this.ready().run("ALTER TABLE conversations ADD COLUMN thread_id TEXT");
    const semanticColumns = new Set(this.all("PRAGMA table_info(semantic_records)").map((row) => String(row.name)));
    if (!semanticColumns.has("embedding_blob")) this.ready().run("ALTER TABLE semantic_records ADD COLUMN embedding_blob BLOB");
    let migratedSemanticVectors = 0;
    for (const row of this.all("SELECT id, embedding_json FROM semantic_records WHERE embedding_blob IS NULL AND embedding_json != '[]'")) {
      const embedding = parseJson(row.embedding_json, []);
      if (embedding.length) {
        this.ready().run("UPDATE semantic_records SET embedding_blob = ?, embedding_json = '[]' WHERE id = ?", [embeddingBytes(embedding), String(row.id)]);
        migratedSemanticVectors += 1;
      }
    }
    if (migratedSemanticVectors) this.ready().run("VACUUM");
    const actionColumns = new Set(this.all("PRAGMA table_info(action_log)").map((row) => String(row.name)));
    if (actionColumns.has("approval_decision") || actionColumns.has("risk_tier") || !actionColumns.has("execution_state")) {
      const legacyResult = actionColumns.has("result_json") ? "COALESCE(result_json, '{}')" : "'{}'";
      const legacyTaskId = actionColumns.has("task_id") ? "task_id" : "NULL";
      const legacyStepId = actionColumns.has("step_id") ? "step_id" : "NULL";
      this.ready().run("BEGIN");
      try {
        this.ready().run("DROP INDEX IF EXISTS idx_action_log_project_timestamp");
        this.ready().run("DROP INDEX IF EXISTS idx_action_log_conversation");
        this.ready().run("ALTER TABLE action_log RENAME TO action_log_legacy");
        this.ready().run("CREATE TABLE action_log (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, timestamp INTEGER NOT NULL, conversation_id TEXT NOT NULL, model_id TEXT NOT NULL, tool_name TEXT NOT NULL, task_id TEXT, step_id TEXT, sanitized_inputs TEXT NOT NULL, execution_state TEXT NOT NULL, execution_duration_ms INTEGER NOT NULL, success INTEGER NOT NULL, result_json TEXT NOT NULL DEFAULT '{}', result_summary TEXT NOT NULL, affected_paths TEXT NOT NULL, exit_code INTEGER, rollback TEXT, FOREIGN KEY(project_id) REFERENCES projects(id))");
        this.ready().run(`INSERT INTO action_log (id, project_id, timestamp, conversation_id, model_id, tool_name, task_id, step_id, sanitized_inputs, execution_state, execution_duration_ms, success, result_json, result_summary, affected_paths, exit_code, rollback)
          SELECT id, project_id, timestamp, conversation_id, model_id, tool_name, ${legacyTaskId}, ${legacyStepId}, sanitized_inputs, CASE WHEN success = 1 THEN 'succeeded' ELSE 'failed' END, execution_duration_ms, success, ${legacyResult}, result_summary, affected_paths, exit_code, rollback FROM action_log_legacy`);
        this.ready().run("DROP TABLE action_log_legacy");
        this.ready().run("COMMIT");
      } catch (error) {
        this.ready().run("ROLLBACK");
        throw error;
      }
    }
    const currentActionColumns = new Set(this.all("PRAGMA table_info(action_log)").map((row) => String(row.name)));
    if (!currentActionColumns.has("result_json")) this.ready().run("ALTER TABLE action_log ADD COLUMN result_json TEXT NOT NULL DEFAULT '{}'");
    if (!currentActionColumns.has("task_id")) this.ready().run("ALTER TABLE action_log ADD COLUMN task_id TEXT");
    if (!currentActionColumns.has("step_id")) this.ready().run("ALTER TABLE action_log ADD COLUMN step_id TEXT");
    const taskColumns = new Set(this.all("PRAGMA table_info(tasks)").map((row) => String(row.name)));
    const addTaskColumn = (name, definition2) => {
      if (!taskColumns.has(name)) this.ready().run(`ALTER TABLE tasks ADD COLUMN ${name} ${definition2}`);
    };
    addTaskColumn("task_type", "TEXT NOT NULL DEFAULT 'general'");
    addTaskColumn("current_step_id", "TEXT");
    addTaskColumn("started_at", "INTEGER");
    addTaskColumn("completed_at", "INTEGER");
    addTaskColumn("originating_conversation_id", "TEXT");
    addTaskColumn("last_active_conversation_id", "TEXT");
    addTaskColumn("assigned_provider", "TEXT");
    addTaskColumn("assigned_model", "TEXT");
    addTaskColumn("progress_summary", "TEXT NOT NULL DEFAULT 'Legacy workspace task imported.'");
    addTaskColumn("retry_metadata", "TEXT");
    addTaskColumn("interruption_reason", "TEXT");
    addTaskColumn("resumability_state", "TEXT NOT NULL DEFAULT 'resumable'");
    addTaskColumn("resume_instructions", "TEXT NOT NULL DEFAULT 'Inspect current workspace state before continuing.'");
    addTaskColumn("associated_branch", "TEXT");
    addTaskColumn("associated_commit_sha", "TEXT");
    addTaskColumn("associated_pull_request", "TEXT");
    addTaskColumn("associated_release_tag", "TEXT");
    addTaskColumn("associated_workflow_run", "TEXT");
    addTaskColumn("process_ids", "TEXT NOT NULL DEFAULT '[]'");
    addTaskColumn("external_resource_ids", "TEXT NOT NULL DEFAULT '[]'");
    this.ready().run(`
      CREATE TABLE IF NOT EXISTS task_dependencies (task_id TEXT NOT NULL, depends_on_task_id TEXT NOT NULL, PRIMARY KEY(task_id, depends_on_task_id), FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE, FOREIGN KEY(depends_on_task_id) REFERENCES tasks(id));
      CREATE TABLE IF NOT EXISTS task_steps (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, position INTEGER NOT NULL, name TEXT NOT NULL, purpose TEXT NOT NULL, status TEXT NOT NULL, risk_tier INTEGER NOT NULL, required_tool TEXT, expected_input TEXT, expected_output TEXT, started_at INTEGER, completed_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, retry_policy TEXT NOT NULL DEFAULT '{}', timeout_ms INTEGER NOT NULL, external_process_id INTEGER, output_path TEXT, artifact_paths TEXT NOT NULL DEFAULT '[]', verification_criteria TEXT NOT NULL DEFAULT '[]', rollback_instructions TEXT, audit_references TEXT NOT NULL DEFAULT '[]', UNIQUE(task_id, position), FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS task_step_dependencies (task_id TEXT NOT NULL, step_id TEXT NOT NULL, depends_on_step_id TEXT NOT NULL, PRIMARY KEY(task_id, step_id, depends_on_step_id), FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE, FOREIGN KEY(step_id) REFERENCES task_steps(id) ON DELETE CASCADE, FOREIGN KEY(depends_on_step_id) REFERENCES task_steps(id));
      CREATE TABLE IF NOT EXISTS task_checkpoints (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, task_id TEXT NOT NULL, step_id TEXT, name TEXT NOT NULL, summary TEXT NOT NULL, verified INTEGER NOT NULL, evidence TEXT NOT NULL, audit_references TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL, FOREIGN KEY(project_id) REFERENCES projects(id), FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE, FOREIGN KEY(step_id) REFERENCES task_steps(id) ON DELETE SET NULL);
      CREATE TABLE IF NOT EXISTS task_artifacts (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, task_id TEXT NOT NULL, step_id TEXT, kind TEXT NOT NULL, path TEXT, uri TEXT, sha256 TEXT, size INTEGER, verified_at INTEGER, metadata TEXT, created_at INTEGER NOT NULL, FOREIGN KEY(project_id) REFERENCES projects(id), FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE, FOREIGN KEY(step_id) REFERENCES task_steps(id) ON DELETE SET NULL);
      CREATE TABLE IF NOT EXISTS task_external_references (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, task_id TEXT NOT NULL, step_id TEXT, type TEXT NOT NULL, provider TEXT, external_id TEXT NOT NULL, url TEXT, state TEXT, metadata TEXT, verified_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(task_id, type, external_id), FOREIGN KEY(project_id) REFERENCES projects(id), FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE, FOREIGN KEY(step_id) REFERENCES task_steps(id) ON DELETE SET NULL);
      CREATE TABLE IF NOT EXISTS task_events (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, task_id TEXT NOT NULL, step_id TEXT, type TEXT NOT NULL, summary TEXT NOT NULL, details TEXT, audit_reference TEXT, created_at INTEGER NOT NULL, FOREIGN KEY(project_id) REFERENCES projects(id), FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE, FOREIGN KEY(step_id) REFERENCES task_steps(id) ON DELETE SET NULL);
    `);
    this.ready().run("DROP TABLE IF EXISTS task_approvals");
    const taskStepColumns = new Set(this.all("PRAGMA table_info(task_steps)").map((row) => String(row.name)));
    if (taskStepColumns.has("approval_state")) this.ready().run("ALTER TABLE task_steps DROP COLUMN approval_state");
    this.ready().run("UPDATE tasks SET status = CASE status WHEN 'todo' THEN 'draft' WHEN 'in-progress' THEN 'running' WHEN 'done' THEN 'completed' ELSE status END");
    this.ready().run("UPDATE tasks SET completed_at = COALESCE(completed_at, updated_at), resumability_state = 'complete' WHERE status = 'completed'");
    this.ready().run(`
      CREATE INDEX IF NOT EXISTS idx_conversations_thread_created ON conversations(thread_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_conversation_threads_project_updated ON conversation_threads(project_id, updated_at);
      CREATE INDEX IF NOT EXISTS idx_action_log_project_timestamp ON action_log(project_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_project_observations_project_timestamp ON project_observations(project_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_action_log_conversation ON action_log(project_id, conversation_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_project_updated ON tasks(project_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_task_steps_task_position ON task_steps(task_id, position);
      CREATE INDEX IF NOT EXISTS idx_task_checkpoints_task_created ON task_checkpoints(task_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_task_events_task_created ON task_events(task_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_task_external_project_type ON task_external_references(project_id, type, external_id);
      CREATE INDEX IF NOT EXISTS idx_browser_bookmarks_project_created ON browser_bookmarks(project_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_browser_history_project_visited ON browser_history(project_id, visited_at DESC);
      CREATE INDEX IF NOT EXISTS idx_semantic_records_project_model ON semantic_records(project_id, embedding_model, embedding_dimensions);
      CREATE INDEX IF NOT EXISTS idx_semantic_records_source_revision ON semantic_records(project_id, source_type, source_id, source_revision);
      CREATE INDEX IF NOT EXISTS idx_semantic_records_lifecycle ON semantic_records(project_id, lifecycle, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_semantic_records_content_hash ON semantic_records(project_id, content_hash, embedding_model);
    `);
  }
  semanticRecordFromRow(row) {
    return { id: String(row.id), workspaceId: String(row.project_id), sourceType: String(row.source_type), sourceId: String(row.source_id), sourceUri: row.source_uri ? String(row.source_uri) : void 0, sourceRevision: String(row.source_revision), chunkIndex: Number(row.chunk_index), lineStart: row.line_start === null ? void 0 : Number(row.line_start), lineEnd: row.line_end === null ? void 0 : Number(row.line_end), contentHash: String(row.content_hash), text: String(row.text), embedding: embeddingFromRow(row), embeddingModel: String(row.embedding_model), embeddingDimensions: Number(row.embedding_dimensions), createdAt: Number(row.created_at), updatedAt: Number(row.updated_at), lastVerifiedAt: Number(row.last_verified_at), lastUsedAt: row.last_used_at === null ? void 0 : Number(row.last_used_at), usageCount: Number(row.usage_count), authorityScore: Number(row.authority_score), lifecycle: String(row.lifecycle), supersededBy: row.superseded_by ? String(row.superseded_by) : void 0, metadata: parseJson(row.metadata_json, {}) };
  }
  async persistSemanticMutation() {
    if (this.semanticWriteBatchDepth > 0) {
      this.semanticWriteDirty = true;
      return;
    }
    await this.persist();
  }
  async ensureProject() {
    if (!this.rootPath) throw new Error("Storage is not initialized.");
    if (this.one("SELECT id FROM projects WHERE root_path = ?", [this.rootPath])) return;
    const now = Date.now();
    this.ready().run("INSERT INTO projects VALUES (?, ?, ?, ?, ?)", [id(), path.basename(this.rootPath), this.rootPath, now, now]);
  }
  async migrateLegacyConversations() {
    const projectId = await this.projectId();
    const legacy = this.one("SELECT COUNT(*) AS count, MIN(created_at) AS first_at, MAX(created_at) AS last_at FROM conversations WHERE project_id = ? AND thread_id IS NULL", [projectId]);
    if (Number(legacy?.count ?? 0) === 0) return;
    const conversationId = id();
    const createdAt = Number(legacy?.first_at ?? Date.now());
    const updatedAt = Number(legacy?.last_at ?? createdAt);
    this.ready().run("INSERT INTO conversation_threads VALUES (?, ?, ?, ?, ?)", [conversationId, projectId, "Imported conversation", createdAt, updatedAt]);
    this.ready().run("UPDATE conversations SET thread_id = ? WHERE project_id = ? AND thread_id IS NULL", [conversationId, projectId]);
    this.setWorkspaceState(projectId, conversationId);
  }
  async ensureActiveConversation() {
    const projectId = await this.projectId();
    const active = this.one(`SELECT s.active_conversation_id AS id FROM workspace_state s
      JOIN conversation_threads t ON t.id = s.active_conversation_id
      WHERE s.project_id = ? AND t.project_id = ?`, [projectId, projectId]);
    if (active?.id) return String(active.id);
    const latest = this.one("SELECT id FROM conversation_threads WHERE project_id = ? ORDER BY updated_at DESC LIMIT 1", [projectId]);
    if (latest?.id) {
      const conversationId = String(latest.id);
      this.setWorkspaceState(projectId, conversationId);
      await this.persist();
      return conversationId;
    }
    const state = await this.createConversation();
    return state.activeConversationId;
  }
  setWorkspaceState(projectId, conversationId) {
    this.ready().run(
      `INSERT INTO workspace_state (project_id, active_conversation_id, layout_json, updated_at)
      VALUES (?, ?, NULL, ?) ON CONFLICT(project_id) DO UPDATE SET active_conversation_id = excluded.active_conversation_id, updated_at = excluded.updated_at`,
      [projectId, conversationId, Date.now()]
    );
  }
  async assertConversation(conversationId) {
    if (!conversationId?.trim()) throw new Error("Conversation id is required.");
    const projectId = await this.projectId();
    if (!this.one("SELECT id FROM conversation_threads WHERE id = ? AND project_id = ?", [conversationId, projectId])) {
      throw new Error("The conversation does not belong to the active workspace.");
    }
    return conversationId;
  }
  async assertTask(taskId) {
    if (!taskId?.trim()) throw new Error("Task id is required.");
    const row = this.one("SELECT * FROM tasks WHERE id = ? AND project_id = ?", [taskId, await this.projectId()]);
    if (!row) throw new Error("The task does not belong to the active workspace.");
    return row;
  }
  async assertTaskStep(taskId, stepId) {
    await this.assertTask(taskId);
    const row = this.one("SELECT * FROM task_steps WHERE id = ? AND task_id = ?", [stepId, taskId]);
    if (!row) throw new Error("The task step does not belong to the task.");
    return row;
  }
  assertAcyclicSteps(stepIds, dependencies) {
    const graph = new Map(stepIds.map((stepId, index) => [stepId, dependencies[index]]));
    const visiting = /* @__PURE__ */ new Set();
    const visited = /* @__PURE__ */ new Set();
    const visit2 = (stepId) => {
      if (visiting.has(stepId)) throw new Error("Task step dependencies contain a cycle.");
      if (visited.has(stepId)) return;
      visiting.add(stepId);
      for (const dependency of graph.get(stepId) ?? []) visit2(dependency);
      visiting.delete(stepId);
      visited.add(stepId);
    };
    for (const stepId of stepIds) visit2(stepId);
  }
  async projectId() {
    const project = await this.dashboard();
    if (!project) throw new Error("No project metadata exists.");
    return project.id;
  }
  goals(projectId) {
    return this.all("SELECT * FROM goals WHERE project_id = ? ORDER BY created_at DESC", [projectId]).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      description: row.description ? String(row.description) : void 0,
      status: String(row.status),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at)
    }));
  }
  tasks(projectId) {
    return this.all("SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC", [projectId]).map((row) => this.taskFromRow(row));
  }
  taskFromRow(row) {
    const taskId = String(row.id);
    const projectId = String(row.project_id);
    const dependencies = this.all("SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ? ORDER BY depends_on_task_id", [taskId]).map((entry) => String(entry.depends_on_task_id));
    const stepDependencies = this.all("SELECT step_id, depends_on_step_id FROM task_step_dependencies WHERE task_id = ?", [taskId]);
    const steps = this.all("SELECT * FROM task_steps WHERE task_id = ? ORDER BY position", [taskId]).map((step) => ({
      id: String(step.id),
      taskId,
      position: Number(step.position),
      name: String(step.name),
      purpose: String(step.purpose),
      status: String(step.status),
      riskTier: Number(step.risk_tier),
      requiredTool: step.required_tool ? String(step.required_tool) : void 0,
      expectedInput: parseJson(step.expected_input, void 0),
      expectedOutput: parseJson(step.expected_output, void 0),
      startedAt: step.started_at === null ? void 0 : Number(step.started_at),
      completedAt: step.completed_at === null ? void 0 : Number(step.completed_at),
      attempts: Number(step.attempts),
      lastError: parseJson(step.last_error, void 0),
      retryPolicy: parseJson(step.retry_policy, { maxAttempts: 1, backoffMs: 0, retryableErrorCodes: [] }),
      timeoutMs: Number(step.timeout_ms),
      externalProcessId: step.external_process_id === null ? void 0 : Number(step.external_process_id),
      outputPath: step.output_path ? String(step.output_path) : void 0,
      artifactPaths: parseJson(step.artifact_paths, []),
      verificationCriteria: parseJson(step.verification_criteria, []),
      rollbackInstructions: step.rollback_instructions ? String(step.rollback_instructions) : void 0,
      auditReferences: parseJson(step.audit_references, []),
      dependencies: stepDependencies.filter((dependency) => String(dependency.step_id) === String(step.id)).map((dependency) => String(dependency.depends_on_step_id))
    }));
    const checkpoints = this.all("SELECT * FROM task_checkpoints WHERE task_id = ? ORDER BY created_at", [taskId]).map((entry) => ({ id: String(entry.id), taskId, stepId: entry.step_id ? String(entry.step_id) : void 0, name: String(entry.name), summary: String(entry.summary), verified: Boolean(entry.verified), evidence: parseJson(entry.evidence, null), auditReferences: parseJson(entry.audit_references, []), createdAt: Number(entry.created_at) }));
    const artifacts = this.all("SELECT * FROM task_artifacts WHERE task_id = ? ORDER BY created_at", [taskId]).map((entry) => ({ id: String(entry.id), taskId, stepId: entry.step_id ? String(entry.step_id) : void 0, kind: String(entry.kind), path: entry.path ? String(entry.path) : void 0, uri: entry.uri ? String(entry.uri) : void 0, sha256: entry.sha256 ? String(entry.sha256) : void 0, size: entry.size === null ? void 0 : Number(entry.size), verifiedAt: entry.verified_at === null ? void 0 : Number(entry.verified_at), metadata: parseJson(entry.metadata, void 0), createdAt: Number(entry.created_at) }));
    const externalReferences = this.all("SELECT * FROM task_external_references WHERE task_id = ? ORDER BY created_at", [taskId]).map((entry) => ({ id: String(entry.id), taskId, stepId: entry.step_id ? String(entry.step_id) : void 0, type: String(entry.type), provider: entry.provider ? String(entry.provider) : void 0, externalId: String(entry.external_id), url: entry.url ? String(entry.url) : void 0, state: entry.state ? String(entry.state) : void 0, metadata: parseJson(entry.metadata, void 0), verifiedAt: entry.verified_at === null ? void 0 : Number(entry.verified_at), createdAt: Number(entry.created_at), updatedAt: Number(entry.updated_at) }));
    const events = this.all("SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at", [taskId]).map((entry) => ({ id: String(entry.id), taskId, stepId: entry.step_id ? String(entry.step_id) : void 0, type: String(entry.type), summary: String(entry.summary), details: parseJson(entry.details, void 0), auditReference: entry.audit_reference ? String(entry.audit_reference) : void 0, createdAt: Number(entry.created_at) }));
    return {
      id: taskId,
      workspaceId: projectId,
      title: String(row.title),
      description: row.description ? String(row.description) : void 0,
      taskType: String(row.task_type ?? "general"),
      status: String(row.status),
      priority: String(row.priority),
      currentStepId: row.current_step_id ? String(row.current_step_id) : void 0,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      startedAt: row.started_at === null ? void 0 : Number(row.started_at),
      completedAt: row.completed_at === null ? void 0 : Number(row.completed_at),
      originatingConversationId: row.originating_conversation_id ? String(row.originating_conversation_id) : void 0,
      lastActiveConversationId: row.last_active_conversation_id ? String(row.last_active_conversation_id) : void 0,
      assignedProvider: row.assigned_provider ? String(row.assigned_provider) : void 0,
      assignedModel: row.assigned_model ? String(row.assigned_model) : void 0,
      progressSummary: String(row.progress_summary ?? ""),
      retryMetadata: parseJson(row.retry_metadata, void 0),
      interruptionReason: row.interruption_reason ? String(row.interruption_reason) : void 0,
      resumabilityState: String(row.resumability_state ?? "resumable"),
      resumeInstructions: String(row.resume_instructions ?? ""),
      associatedBranch: row.associated_branch ? String(row.associated_branch) : void 0,
      associatedCommitSha: row.associated_commit_sha ? String(row.associated_commit_sha) : void 0,
      associatedPullRequest: row.associated_pull_request ? String(row.associated_pull_request) : void 0,
      associatedReleaseTag: row.associated_release_tag ? String(row.associated_release_tag) : void 0,
      associatedWorkflowRun: row.associated_workflow_run ? String(row.associated_workflow_run) : void 0,
      processIds: parseJson(row.process_ids, []),
      externalResourceIds: parseJson(row.external_resource_ids, []),
      steps,
      taskDependencies: dependencies,
      checkpoints,
      artifacts,
      externalReferences,
      events
    };
  }
  appendTaskEventRow(taskId, stepId, type, summary, details, auditReference) {
    const task = this.one("SELECT project_id FROM tasks WHERE id = ?", [taskId]);
    if (!task) throw new Error("Unknown task.");
    this.ready().run("INSERT INTO task_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [id(), String(task.project_id), taskId, stepId ?? null, type, summary, details === void 0 ? null : JSON.stringify(sanitizeTaskData(details)), auditReference ?? null, Date.now()]);
  }
  all(sql, params = []) {
    const result = this.ready().exec(sql, params);
    if (!result[0]) return [];
    return result[0].values.map((values) => Object.fromEntries(result[0].columns.map((column, index) => [column, values[index]])));
  }
  one(sql, params = []) {
    return this.all(sql, params)[0];
  }
  ready() {
    if (!this.db) throw new Error("Storage is not initialized.");
    return this.db;
  }
  pruneProjectObservations() {
    const projectId = this.one("SELECT id FROM projects WHERE root_path = ?", [this.rootPath])?.id;
    if (!projectId) return false;
    const count = Number(this.one("SELECT COUNT(*) AS count FROM project_observations WHERE project_id = ?", [String(projectId)])?.count ?? 0);
    if (count <= MAX_PROJECT_OBSERVATIONS) return false;
    this.ready().run(`DELETE FROM project_observations WHERE project_id = ? AND id NOT IN (
      SELECT id FROM project_observations WHERE project_id = ? ORDER BY timestamp DESC, id DESC LIMIT ?
    )`, [String(projectId), String(projectId), MAX_PROJECT_OBSERVATIONS]);
    return true;
  }
  async persist() {
    if (!this.db || !this.filePath || !this.sql) return;
    const destination = this.filePath;
    const database = this.db;
    const temporary = `${destination}.${id()}.tmp`;
    const backup = `${destination}.backup`;
    const backupTemporary = `${backup}.${id()}.tmp`;
    const SQL = this.sql;
    const operation = this.persistQueue.then(async () => {
      try {
        const bytes = database.export();
        await writeSyncedFile(temporary, bytes);
        const written = await promises.readFile(temporary);
        const verification = openHealthyDatabase(SQL, written);
        verification.close();
        if (await promises.stat(destination).then(() => true).catch(() => false)) {
          await promises.link(destination, backupTemporary).catch(() => promises.copyFile(destination, backupTemporary));
          await promises.rm(backup, { force: true });
          await promises.rename(backupTemporary, backup);
        }
        await promises.rename(temporary, destination);
        await syncDirectory(path.dirname(destination));
      } catch (error) {
        await Promise.all([temporary, backupTemporary].map((entry) => promises.rm(entry, { force: true }).catch(() => void 0)));
        throw error;
      }
    });
    this.persistQueue = operation.catch(() => void 0);
    await operation;
  }
}
function embeddingBytes(values) {
  const floats = values instanceof Float32Array ? values : Float32Array.from(values);
  return new Uint8Array(floats.buffer.slice(floats.byteOffset, floats.byteOffset + floats.byteLength));
}
function embeddingFromRow(row) {
  if (row.embedding_blob instanceof Uint8Array && row.embedding_blob.byteLength % Float32Array.BYTES_PER_ELEMENT === 0) {
    const bytes = row.embedding_blob;
    const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return new Float32Array(copy);
  }
  return parseJson(row.embedding_json, []);
}
function openHealthyDatabase(SQL, bytes) {
  const database = new SQL.Database(bytes);
  try {
    const result = database.exec("PRAGMA quick_check");
    const messages = result[0]?.values.flat().map(String) ?? [];
    if (messages.length !== 1 || messages[0] !== "ok") throw new Error(messages[0] || "SQLite quick check returned no result.");
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}
function malformedDatabaseError(filePath2, primaryError, backupError) {
  const detail = primaryError instanceof Error ? primaryError.message : String(primaryError);
  const backupDetail = backupError === void 0 ? "No last-known-good backup exists." : `The backup is also invalid: ${backupError instanceof Error ? backupError.message : String(backupError)}`;
  return new Error(`Workspace database is malformed: ${filePath2}. ${backupDetail} The original was not changed. SQLite reported: ${detail}`);
}
async function writeSyncedFile(filePath2, bytes) {
  const handle = await promises.open(filePath2, "wx");
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function syncDirectory(directory) {
  const handle = await promises.open(directory, "r").catch(() => null);
  if (!handle) return;
  try {
    await handle.sync().catch(() => void 0);
  } finally {
    await handle.close();
  }
}
const DEFAULT_OPENAI_MODEL = "gpt-5.6-sol";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";
function responsesCompatibleSchema(value) {
  if (Array.isArray(value)) return value.map(responsesCompatibleSchema);
  if (!value || typeof value !== "object") return value;
  const schema = Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, responsesCompatibleSchema(entry)]));
  if (schema.exclusiveMinimum === true && typeof schema.minimum === "number") {
    schema.exclusiveMinimum = schema.minimum;
    delete schema.minimum;
  }
  if (schema.exclusiveMaximum === true && typeof schema.maximum === "number") {
    schema.exclusiveMaximum = schema.maximum;
    delete schema.maximum;
  }
  return schema;
}
function legacyToolAlias(name) {
  return `forge_${name.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}
function providerToolNames(tools) {
  const names = /* @__PURE__ */ new Map();
  const legacyCandidates = /* @__PURE__ */ new Map();
  tools.forEach((tool, index) => {
    names.set(`forge_${index}_${tool.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`, tool.name);
    names.set(tool.name, tool.name);
    const legacy = legacyToolAlias(tool.name);
    legacyCandidates.set(legacy, [...legacyCandidates.get(legacy) ?? [], tool.name]);
  });
  for (const [alias, candidates] of legacyCandidates) {
    if (candidates.length === 1) names.set(alias, candidates[0]);
  }
  return names;
}
class OpenAIProvider {
  id = "openai";
  apiKey;
  baseUrl;
  model;
  constructor(opts) {
    this.apiKey = opts?.apiKey ?? process.env.OPENAI_API_KEY;
    this.baseUrl = this.normalizeBaseUrl(opts?.baseUrl ?? process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL);
    this.model = this.normalizeModel(opts?.model ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL);
  }
  configure(opts) {
    this.apiKey = opts.apiKey;
    this.baseUrl = this.normalizeBaseUrl(opts.baseUrl);
    this.model = this.normalizeModel(opts.model);
  }
  async isConfigured() {
    return Boolean(this.apiKey) || this.isLoopbackProvider();
  }
  async listModels() {
    const response = await this.authorizedFetch(`${this.baseUrl}/models`);
    if (!response.ok) throw await this.providerError(response, "Could not list models");
    const payload = await response.json();
    const rawModels = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.models) ? payload.models.map((model) => ({ id: model.id ?? model.name, owned_by: model.owned_by })) : null;
    if (!rawModels) throw new Error("The AI provider returned an invalid model list. You can still enter a model ID manually.");
    return rawModels.filter((model) => typeof model.id === "string" && Boolean(model.id.trim())).map((model) => ({ id: model.id, ownedBy: typeof model.owned_by === "string" ? model.owned_by : void 0 })).sort((left, right) => left.id.localeCompare(right.id));
  }
  async validateModel(model = this.model) {
    const normalized = this.normalizeModel(model);
    const models = await this.listModels();
    return { model: normalized, exists: models.some((entry) => entry.id === normalized), availableCount: models.length };
  }
  async testConnection() {
    const validation = await this.validateModel();
    if (!validation.exists) {
      throw new Error(`The saved model "${validation.model}" is not available to this API key. Choose another model or refresh the provider model list.`);
    }
    return validation;
  }
  async chat(messages, model = this.model) {
    const selectedModel = this.normalizeModel(model);
    const request = {
      model: selectedModel,
      messages: messages.map((message) => ({ role: message.role, content: message.content })),
      max_completion_tokens: 1600
    };
    let response = await this.authorizedFetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });
    if (!response.ok) {
      const errorText = await response.clone().text();
      if (response.status === 400 && /max_completion_tokens|unknown parameter|unsupported parameter/i.test(errorText)) {
        const { max_completion_tokens: _ignored, ...compatibleRequest } = request;
        response = await this.authorizedFetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...compatibleRequest, max_tokens: 1600 })
        });
      }
    }
    if (!response.ok) throw await this.providerError(response, `AI request failed for model "${selectedModel}"`);
    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) return "";
    return typeof choice.message?.content === "string" ? choice.message.content : String(choice.text ?? "");
  }
  async chatWithTools(messages, tools, model = this.model) {
    const selectedModel = this.normalizeModel(model);
    const availableTools = tools;
    const providerNames = providerToolNames(availableTools);
    const aliasedTools = availableTools.map((tool, index) => {
      const alias = `forge_${index}_${tool.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
      return { alias, tool };
    });
    if (this.usesResponsesForTools(selectedModel)) {
      return this.responsesWithTools(messages, aliasedTools, providerNames, selectedModel);
    }
    const providerTools = aliasedTools.map(({ alias, tool }) => ({
      type: "function",
      function: { name: alias, description: `${tool.description} (FORGE tool: ${tool.name})`, parameters: responsesCompatibleSchema(tool.parameters) }
    }));
    const request = {
      model: selectedModel,
      messages: messages.map((message2) => ({ role: message2.role, content: message2.content })),
      tools: providerTools,
      tool_choice: "auto",
      // FORGE continues from observed results until progress stops. Request one
      // call at a time so an audit is never rejected for a burst of parallel
      // calls in a single provider response.
      parallel_tool_calls: false,
      max_completion_tokens: 1e4
    };
    let compatibleRequest = request;
    let response = await this.authorizedFetch(`${this.baseUrl}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(compatibleRequest) });
    for (let attempt = 0; !response.ok && response.status === 400 && attempt < 2; attempt += 1) {
      const errorText = await response.clone().text();
      const next = { ...compatibleRequest };
      if (/parallel_tool_calls/i.test(errorText) && "parallel_tool_calls" in next) {
        delete next.parallel_tool_calls;
      } else if (/max_completion_tokens|unknown parameter|unsupported parameter/i.test(errorText) && "max_completion_tokens" in next) {
        const limit = next.max_completion_tokens;
        delete next.max_completion_tokens;
        next.max_tokens = limit;
      } else {
        break;
      }
      compatibleRequest = next;
      response = await this.authorizedFetch(`${this.baseUrl}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(compatibleRequest) });
    }
    if (!response.ok) throw await this.providerError(response, `AI request failed for model "${selectedModel}"`);
    const data = await response.json();
    const message = data.choices?.[0]?.message;
    const toolCalls = (message?.tool_calls ?? []).map((raw) => {
      const call = raw;
      if (typeof call.function?.name !== "string" || typeof call.function.arguments !== "string") throw new Error("The provider returned a malformed tool call.");
      let args;
      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        throw new Error("The provider returned malformed tool arguments.");
      }
      return { id: typeof call.id === "string" ? call.id : crypto.randomUUID(), name: providerNames.get(call.function.name) ?? call.function.name, arguments: args, provider: this.id };
    });
    const content = typeof message?.content === "string" ? message.content : "";
    if (toolCalls.length === 0) {
      const textCall = this.textToolCall(content, availableTools, providerNames);
      if (textCall) return { content: "", toolCalls: [textCall], modelId: selectedModel };
    }
    return { content, toolCalls, modelId: selectedModel };
  }
  async responsesWithTools(messages, tools, providerNames, selectedModel) {
    const request = {
      model: selectedModel,
      input: messages.map((message) => ({ role: message.role, content: message.content })),
      tools: tools.map(({ alias, tool }) => ({
        type: "function",
        name: alias,
        description: `${tool.description} (FORGE tool: ${tool.name})`,
        parameters: responsesCompatibleSchema(tool.parameters)
      })),
      tool_choice: "auto",
      // This is deliberately not a total tool budget. The native runtime
      // observes one result, then asks for the next dependency-ready call.
      parallel_tool_calls: false,
      max_output_tokens: 1e4
    };
    const response = await this.authorizedFetch(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });
    if (!response.ok) throw await this.providerError(response, `AI request failed for model "${selectedModel}"`);
    const data = await response.json();
    if (!Array.isArray(data.output)) throw new Error("The provider returned a malformed Responses API result.");
    const toolCalls = data.output.filter((item) => item.type === "function_call").map((call) => {
      if (typeof call.name !== "string" || typeof call.arguments !== "string") throw new Error("The provider returned a malformed tool call.");
      let args;
      try {
        args = JSON.parse(call.arguments);
      } catch {
        throw new Error("The provider returned malformed tool arguments.");
      }
      return {
        id: typeof call.call_id === "string" ? call.call_id : crypto.randomUUID(),
        name: providerNames.get(call.name) ?? call.name,
        arguments: args,
        provider: this.id
      };
    });
    const content = typeof data.output_text === "string" ? data.output_text : data.output.filter((item) => item.type === "message").flatMap((item) => item.content ?? []).filter((part) => part.type === "output_text" && typeof part.text === "string").map((part) => part.text).join("");
    return { content, toolCalls, modelId: typeof data.model === "string" ? data.model : selectedModel };
  }
  async authorizedFetch(url, init = {}) {
    if (!this.apiKey && !this.isLoopbackProvider()) throw new Error("An API key is required for remote AI providers. Loopback providers such as Ollama may run without one.");
    return fetch(url, {
      ...init,
      headers: this.apiKey ? { ...init.headers, Authorization: `Bearer ${this.apiKey}` } : init.headers
    });
  }
  isLoopbackProvider() {
    const hostname2 = new URL(this.baseUrl).hostname.toLowerCase();
    return ["localhost", "127.0.0.1", "::1"].includes(hostname2);
  }
  textToolCall(content, tools, providerNames) {
    const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    if (!trimmed.startsWith("{")) return null;
    try {
      const value = JSON.parse(trimmed);
      const requestedName = value.name ?? value.tool;
      const requestedArguments = value.parameters ?? value.arguments;
      if (typeof requestedName !== "string" || !requestedArguments || typeof requestedArguments !== "object" || Array.isArray(requestedArguments)) return null;
      const stableName = providerNames.get(requestedName) ?? requestedName;
      if (!tools.some((tool) => tool.name === stableName)) return null;
      return { id: crypto.randomUUID(), name: stableName, arguments: requestedArguments, provider: this.id };
    } catch {
      return null;
    }
  }
  async providerError(response, prefix) {
    const text = await response.text();
    let detail = text;
    let code;
    try {
      const parsed = JSON.parse(text);
      detail = parsed.error?.message ?? parsed.message ?? text;
      code = parsed.error?.code;
    } catch {
    }
    if (response.status === 404 || code === "model_not_found" || /model.+(?:not found|does not exist|not available)/i.test(detail)) {
      return new Error(`${prefix}: the model is unsupported or unavailable for this provider. Refresh models in Settings or enter a different model ID.`);
    }
    return new Error(`${prefix} (${response.status}): ${detail || response.statusText}`);
  }
  normalizeBaseUrl(value) {
    const normalized = value.trim().replace(/\/$/, "");
    if (!normalized) throw new Error("API base URL is required.");
    const parsed = new URL(normalized);
    if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("API base URL must use HTTPS or HTTP.");
    if (parsed.username || parsed.password) throw new Error("API base URL must not contain credentials.");
    const loopback = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname.toLowerCase());
    if (parsed.protocol === "http:" && !loopback) throw new Error("Remote API base URLs must use HTTPS. HTTP is allowed only for loopback providers.");
    return parsed.toString().replace(/\/$/, "");
  }
  normalizeModel(value) {
    const normalized = value.trim();
    if (!normalized) throw new Error("AI model ID is required.");
    return normalized;
  }
  usesResponsesForTools(model) {
    return /^gpt-5\.6(?:-|$)/i.test(model);
  }
}
class Agent {
  constructor(provider, contextBuilder2, memoryRetriever2) {
    this.provider = provider;
    this.contextBuilder = contextBuilder2;
    this.memoryRetriever = memoryRetriever2;
  }
  async askWithContext(question, history = []) {
    const prepared = await this.prepare(question, history);
    return { content: await this.provider.chat(prepared.messages), memories: prepared.memories, context: prepared.context };
  }
  async askWithTools(question, history = [], tools = []) {
    const prepared = await this.prepare(question, history);
    const response = this.provider.chatWithTools ? await this.provider.chatWithTools(prepared.messages, tools) : { content: await this.provider.chat(prepared.messages), toolCalls: [] };
    return { content: response.content, toolCalls: response.toolCalls, modelId: response.modelId, memories: prepared.memories, context: prepared.context };
  }
  async prepare(question, history) {
    let memories = [];
    if (this.memoryRetriever) {
      try {
        memories = await this.memoryRetriever.search(question, 6);
      } catch {
        memories = [];
      }
    }
    const context = this.contextBuilder.packet ? await this.contextBuilder.packet(question, memories) : await this.contextBuilder.assemble(question, memories);
    const boundedHistory = history.filter((message) => message.role === "user" || message.role === "assistant").slice(-48).reduceRight((selected, message) => {
      const used = selected.reduce((total, entry) => total + entry.content.length, 0);
      return used >= 4e4 ? selected : [{ role: message.role, content: message.content.slice(0, 6e3) }, ...selected];
    }, []);
    const messages = [
      { role: "system", content: context.systemPrompt },
      ...boundedHistory,
      { role: "user", content: question }
    ];
    return { messages, memories, context };
  }
  async ask(question, history = []) {
    return (await this.askWithContext(question, history)).content;
  }
  async explainProject(history = []) {
    return this.ask("Explain this repository as an evidence-grounded architecture summary.", history);
  }
  async reviewChanges(history = []) {
    return this.ask("Review the current repository changes against its documented architecture and project goals.", history);
  }
}
const DEFAULT_EMBEDDING_BASE_URL = "http://127.0.0.1:11434/v1";
const DEFAULT_EMBEDDING_MODEL = "qwen3-embedding:0.6b";
const SEMANTIC_SCHEMA_VERSION = 1;
const DEFAULT_CONTEXT_TOKEN_BUDGET = 32e3;
const DEFAULT_SEMANTIC_RESULT_LIMIT = 8;
const MAX_SEMANTIC_RESULT_LIMIT = 10;
const DEFAULT_SEMANTIC_TOKEN_BUDGET = 4e3;
const MAX_SEMANTIC_CANDIDATES = 2e3;
const EMBEDDING_BATCH_SIZE = 8;
const SOURCE_AUTHORITY = Object.freeze({
  runtime: 1,
  configuration: 0.96,
  source: 0.94,
  git: 0.9,
  documentation: 0.82,
  architecture: 0.86,
  task: 0.78,
  decision: 0.8,
  memory: 0.72,
  tool: 0.7,
  event: 0.66,
  conversation: 0.48
});
const GOVERNOR_WEIGHTS = Object.freeze({
  semanticRelevance: 0.45,
  taskRelationship: 0.12,
  authority: 0.16,
  freshness: 0.12,
  priorUsefulness: 0.05,
  stalenessPenalty: 0.08,
  redundancyPenalty: 0.08,
  supersessionPenalty: 0.2
});
const SENSITIVE_SEGMENTS = /* @__PURE__ */ new Set([".env", ".ssh", ".gnupg", "credentials", "secrets", "private", "keychain", "keystore"]);
const GENERATED_SEGMENTS = /* @__PURE__ */ new Set([".git", ".forge", "node_modules", "dist", "dist_electron", "out", "build", "release", "coverage", ".cache", "__pycache__", "archiso-work", "archiso-profile", "airootfs"]);
const INDEXABLE_EXTENSIONS = /* @__PURE__ */ new Set(["md", "markdown", "txt", "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rs", "go", "java", "kt", "swift", "c", "h", "cpp", "hpp", "css", "scss", "html", "json", "jsonc", "yaml", "yml", "toml", "ini", "conf", "sh", "bash", "zsh", "fish", "ps1", "sql", "graphql"]);
function normalizePortablePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}
function isSensitiveOrGeneratedPath(value) {
  const normalized = normalizePortablePath(value).toLowerCase();
  const parts = normalized.split("/");
  const name = parts.at(-1) ?? "";
  return parts.some((part) => GENERATED_SEGMENTS.has(part) || SENSITIVE_SEGMENTS.has(part)) || /^\.env(?:\.|$)/i.test(name) || /(?:^|[._-])(?:secrets?|credentials?|passwords?|private[_-]?key|api[_-]?key)(?:[._-]|$)/i.test(name) || /\.(?:pem|p12|pfx|key|kdbx)$/i.test(name);
}
function containsLikelySecret(text) {
  return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk-|github_pat_|gh[oprsu]_)[A-Za-z0-9_-]{16,}|\b(?:api[_-]?key|access[_-]?token|password)\s*[:=]\s*['"]?[^\s'"]{8,}/i.test(text);
}
function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
function bounded(value) {
  return Math.max(0, Math.min(1, value));
}
function estimateTokens(value) {
  return Math.max(1, Math.ceil(value.length / 4));
}
function chunkText(text, options = {}) {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  const maximum = Math.max(400, options.maxChars ?? 2400);
  const overlapLines = Math.max(0, Math.min(12, options.overlapLines ?? 3));
  const lines = normalized.split("\n");
  const chunks = [];
  let start = 0;
  while (start < lines.length) {
    let end = start;
    let characters = 0;
    let preferredEnd = -1;
    while (end < lines.length) {
      const addition = lines[end].length + (end > start ? 1 : 0);
      if (characters + addition > maximum && end > start) break;
      characters += addition;
      end += 1;
      if (end < lines.length && (/^#{1,6}\s/.test(lines[end]) || lines[end - 1].trim() === "" && characters >= maximum * 0.55)) preferredEnd = end;
    }
    if (preferredEnd > start && end < lines.length) end = preferredEnd;
    const value = lines.slice(start, end).join("\n").trim();
    if (value) chunks.push({ index: chunks.length, text: value, lineStart: start + 1, lineEnd: end, contentHash: hash(value) });
    if (end >= lines.length) break;
    start = Math.max(start + 1, end - overlapLines);
  }
  return chunks;
}
function cosineSimilarity(left, right) {
  if (!left.length || left.length !== right.length) return -1;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : -1;
}
class OpenAICompatibleEmbeddingClient {
  constructor(configuration, events) {
    this.configuration = configuration;
    this.events = events;
  }
  requestQueue = Promise.resolve();
  sessionDepth = 0;
  async listModels(overrides = {}) {
    const config = { ...await this.configuration(), ...overrides };
    const response = await this.request(`${normalizeBaseUrl(config.baseUrl)}/models`, config);
    if (!response.ok) throw new Error(`Embedding provider model discovery failed (${response.status}).`);
    const payload = await response.json();
    const models = payload.data ?? payload.models?.map((entry) => ({ id: entry.id ?? entry.name, owned_by: entry.owned_by })) ?? [];
    return models.filter((entry) => typeof entry.id === "string").map((entry) => ({ id: entry.id, ownedBy: typeof entry.owned_by === "string" ? entry.owned_by : void 0 })).sort((a, b) => a.id.localeCompare(b.id));
  }
  async validateModel(model, overrides = {}) {
    return this.withModelSession(async () => {
      const config = { ...await this.configuration(), ...overrides };
      const selected = (model || config.model).trim();
      const models = await this.listModels(config);
      const exists2 = models.some((entry) => entry.id === selected);
      const dimensions = exists2 ? (await this.embed(["FORGE semantic context model validation"], { ...config, model: selected }))[0]?.length : void 0;
      return { model: selected, exists: exists2, availableCount: models.length, dimensions };
    });
  }
  async embed(input, overrides = {}) {
    if (!input.length) return [];
    return this.serialized(async () => {
      const config = { ...await this.configuration(), ...overrides };
      if (!config.enabled && overrides.enabled === void 0) throw new Error("Semantic context is disabled.");
      await this.events?.({ type: "semantic.embedding.request", payload: { model: config.model, batchSize: input.length } });
      const response = await this.request(`${normalizeBaseUrl(config.baseUrl)}/embeddings`, config, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: config.model, input, encoding_format: "float" }) }, 9e4);
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500).replace(/[\r\n]+/g, " ");
        throw new Error(`Embedding request failed (${response.status}): ${detail || response.statusText}`);
      }
      const payload = await response.json();
      if (!Array.isArray(payload.data)) throw new Error("Embedding provider returned an invalid response.");
      const ordered = [...payload.data].sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0));
      const vectors = ordered.map((entry) => Array.isArray(entry.embedding) ? entry.embedding.map(Number) : []);
      if (vectors.length !== input.length || vectors.some((vector) => !vector.length || vector.some((value) => !Number.isFinite(value)))) throw new Error("Embedding provider returned malformed or incomplete vectors.");
      const dimensions = vectors[0].length;
      if (vectors.some((vector) => vector.length !== dimensions)) throw new Error("Embedding provider returned inconsistent vector dimensions.");
      return vectors;
    });
  }
  async withModelSession(operation) {
    this.sessionDepth += 1;
    try {
      return await operation();
    } finally {
      this.sessionDepth -= 1;
      if (this.sessionDepth === 0) await this.unloadLocalOllamaModel().catch(() => void 0);
    }
  }
  async serialized(operation) {
    const run = this.requestQueue.then(operation, operation);
    this.requestQueue = run.then(() => void 0, () => void 0);
    return run;
  }
  async unloadLocalOllamaModel() {
    const config = await this.configuration();
    if (!config.enabled) return;
    const base = new URL(normalizeBaseUrl(config.baseUrl));
    if (!["localhost", "127.0.0.1", "::1"].includes(base.hostname.toLowerCase()) || !/\/v1\/?$/.test(base.pathname)) return;
    await this.serialized(async () => {
      const response = await fetch(new URL("/api/generate", base.origin), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: config.model, prompt: "", stream: false, keep_alive: 0 }), signal: AbortSignal.timeout(15e3) });
      if (!response.ok) throw new Error(`Embedding model unload failed (${response.status}).`);
      await response.arrayBuffer();
    });
  }
  async request(url, configuration, init = {}, timeoutMs = 2e4) {
    const parsed = new URL(url);
    const loopback = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname.toLowerCase());
    if (parsed.protocol === "http:" && !loopback) throw new Error("Remote embedding endpoints must use HTTPS.");
    if (!configuration.apiKey && !loopback) throw new Error("A securely stored API key is required for remote embedding endpoints.");
    return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), headers: configuration.apiKey ? { ...init.headers, Authorization: `Bearer ${configuration.apiKey}` } : init.headers });
  }
}
function normalizeBaseUrl(value) {
  const parsed = new URL(value.trim());
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("Embedding API base URL is invalid.");
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname.toLowerCase());
  if (parsed.protocol === "http:" && !loopback) throw new Error("Remote embedding endpoints must use HTTPS.");
  return parsed.toString().replace(/\/$/, "");
}
function flattenFiles(nodes) {
  return nodes.flatMap((node) => [...node.type === "file" ? [{ path: normalizePortablePath(node.relativePath || node.path), extension: node.extension }] : [], ...flattenFiles(node.children ?? [])]);
}
function authorityFor(sourceType) {
  return SOURCE_AUTHORITY[sourceType] ?? 0.6;
}
class SemanticIndexer {
  constructor(workspace2, storage2, embeddings, configuration, events) {
    this.workspace = workspace2;
    this.storage = storage2;
    this.embeddings = embeddings;
    this.configuration = configuration;
    this.events = events;
  }
  running = null;
  pending = null;
  generation = 0;
  stopping = false;
  incremental() {
    return this.schedule({ rebuild: false, full: true, durable: true, paths: /* @__PURE__ */ new Set() });
  }
  refreshPaths(paths) {
    return this.schedule({ rebuild: false, full: false, durable: false, paths: new Set(paths.map(normalizePortablePath)) });
  }
  refreshDurableState() {
    return this.schedule({ rebuild: false, full: false, durable: true, paths: /* @__PURE__ */ new Set() });
  }
  rebuild() {
    return this.schedule({ rebuild: true, full: true, durable: true, paths: /* @__PURE__ */ new Set() });
  }
  async stop() {
    this.stopping = true;
    this.pending = null;
    this.generation += 1;
    await this.running?.catch(() => void 0);
    this.pending = null;
    this.generation += 1;
    this.stopping = false;
  }
  async indexSource(source) {
    return (await this.indexSources([source]))[0] ?? { records: [], embedded: 0 };
  }
  async indexSources(sources) {
    const config = await this.configuration();
    const plans = await Promise.all(sources.map(async (source) => {
      if (!source.text.trim() || containsLikelySecret(source.text)) return { source, chunks: [], existingByHash: /* @__PURE__ */ new Map() };
      const chunks = chunkText(source.text);
      const existing = await this.storage.semanticRecords({ sourceType: source.sourceType, sourceId: source.sourceId, embeddingModel: config.model, includeSuperseded: true });
      return { source, chunks, existingByHash: new Map(existing.map((record) => [`${record.chunkIndex}:${record.contentHash}`, record])) };
    }));
    const missing = plans.flatMap((plan, planIndex) => plan.chunks.filter((chunk) => !plan.existingByHash.has(`${chunk.index}:${chunk.contentHash}`)).map((chunk) => ({ planIndex, chunk })));
    const vectors = [];
    for (let offset = 0; offset < missing.length; offset += EMBEDDING_BATCH_SIZE) vectors.push(...await this.embeddings.embed(missing.slice(offset, offset + EMBEDDING_BATCH_SIZE).map((entry) => entry.chunk.text)));
    const vectorsByChunk = new Map(missing.map((entry, index) => [`${entry.planIndex}:${entry.chunk.index}`, vectors[index]]));
    const results = [];
    for (let planIndex = 0; planIndex < plans.length; planIndex += 1) {
      const { source, chunks, existingByHash } = plans[planIndex];
      const records = [];
      let embedded = 0;
      for (const chunk of chunks) {
        const prior = existingByHash.get(`${chunk.index}:${chunk.contentHash}`);
        const vector = vectorsByChunk.get(`${planIndex}:${chunk.index}`);
        const embedding = prior?.embedding ?? vector;
        if (!embedding) continue;
        if (!prior) embedded += 1;
        const result = await this.storage.upsertSemanticRecord({ id: prior?.id ?? randomUUID(), sourceType: source.sourceType, sourceId: source.sourceId, sourceUri: source.sourceUri, sourceRevision: source.revision, chunkIndex: chunk.index, lineStart: chunk.lineStart, lineEnd: chunk.lineEnd, contentHash: chunk.contentHash, text: chunk.text, embedding, embeddingModel: config.model, embeddingDimensions: embedding.length, authorityScore: source.authority ?? authorityFor(source.sourceType), lifecycle: "active", metadata: { schemaVersion: SEMANTIC_SCHEMA_VERSION, ...source.metadata } });
        records.push(result.record);
      }
      await this.storage.supersedeSemanticSource(source.sourceType, source.sourceId, source.revision, records.map((record) => record.id));
      results.push({ records, embedded });
    }
    return results;
  }
  schedule(request) {
    if (this.stopping) return this.storage.semanticIndexStatus();
    if (!this.pending) this.pending = request;
    else {
      this.pending.rebuild ||= request.rebuild;
      this.pending.full ||= request.full;
      this.pending.durable ||= request.durable;
      for (const entry of request.paths) this.pending.paths.add(entry);
    }
    if (this.running) return this.running;
    this.running = this.drain().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  async drain() {
    let status = await this.storage.semanticIndexStatus();
    while (this.pending) {
      const request = this.pending;
      this.pending = null;
      status = await this.execute(request);
    }
    return status;
  }
  async execute(request) {
    const generation = this.generation;
    const ensureCurrent = () => {
      if (generation !== this.generation) throw new SemanticIndexCancelledError();
    };
    const config = await this.configuration();
    if (!config.enabled) return this.storage.setSemanticIndexState({ state: "empty" });
    const prior = await this.storage.semanticIndexStatus();
    if (!request.rebuild && prior.embeddingModel && prior.embeddingModel !== config.model) return this.storage.setSemanticIndexState({ state: "rebuild-required", lastError: `Embedding model changed from ${prior.embeddingModel} to ${config.model}. Rebuild the semantic index before retrieval.` });
    await this.events?.({ type: "semantic.index.start", payload: { rebuild: request.rebuild, full: request.full, changedPaths: request.paths.size, model: config.model } });
    await this.storage.setSemanticIndexState({ state: "indexing", embeddingModel: config.model });
    try {
      return await this.embeddings.withModelSession(() => this.storage.withSemanticWriteBatch(async () => {
        ensureCurrent();
        if (request.rebuild) await this.storage.clearSemanticIndex();
        const files = request.full ? flattenFiles(await this.workspace.list("", { recursive: true, maxEntries: 2e4, showHidden: false })).filter(indexableFile) : [...request.paths].map((filePath2) => ({ path: filePath2, extension: path.extname(filePath2).slice(1) })).filter(indexableFile);
        let embedded = 0;
        const presentSourceIds = [];
        let sourceBatch = [];
        const flushSourceBatch = async () => {
          if (!sourceBatch.length) return;
          for (const result of await this.indexSources(sourceBatch)) embedded += result.embedded;
          sourceBatch = [];
        };
        for (const file of files) {
          ensureCurrent();
          const metadata = await this.workspace.metadata(file.path).catch(() => null);
          if (!metadata?.text || metadata.size > 1e6) {
            await this.supersedeMissingPath(file.path);
            continue;
          }
          const content = await this.workspace.readFile(file.path).catch(() => null);
          if (!content || content.binary || containsLikelySecret(content.content)) {
            await this.supersedeMissingPath(file.path);
            continue;
          }
          presentSourceIds.push(file.path);
          sourceBatch.push({ sourceType: classifySource(file.path), sourceId: file.path, sourceUri: file.path, revision: `${metadata.modifiedAt}:${metadata.size}:${hash(content.content)}`, text: content.content, metadata: { path: file.path, modifiedAt: metadata.modifiedAt, size: metadata.size } });
          if (sourceBatch.length >= 32) await flushSourceBatch();
        }
        await flushSourceBatch();
        ensureCurrent();
        if (request.full) await this.storage.supersedeSemanticSourcesMissing(["source", "configuration", "documentation", "architecture"], presentSourceIds);
        if (request.durable) embedded += await this.indexDurableState();
        await this.storage.updateSemanticLifecycle();
        await this.storage.pruneSupersededSemanticRecords();
        const records = await this.storage.semanticRecords({ embeddingModel: config.model, limit: 5e3 });
        const dimensions = records[0]?.embeddingDimensions;
        if (records.some((record) => record.embeddingDimensions !== dimensions)) return this.storage.setSemanticIndexState({ state: "rebuild-required", embeddingModel: config.model, lastError: "The semantic index contains incompatible embedding dimensions." });
        const status = await this.storage.setSemanticIndexState({ state: "ready", embeddingModel: config.model, embeddingDimensions: dimensions, lastIndexedAt: Date.now() });
        await this.events?.({ type: "semantic.index.complete", payload: { indexedRecords: status.indexedRecords, newlyEmbedded: embedded, model: config.model, dimensions } });
        return status;
      }));
    } catch (error) {
      if (error instanceof SemanticIndexCancelledError) {
        await this.events?.({ type: "semantic.index.error", payload: { message: "Semantic indexing was cancelled because the workspace changed." } });
        await this.storage.setSemanticIndexState({ state: prior.state, embeddingModel: prior.embeddingModel, embeddingDimensions: prior.embeddingDimensions, lastIndexedAt: prior.lastIndexedAt });
        return this.storage.semanticIndexStatus();
      }
      const message = error instanceof Error ? error.message : String(error);
      await this.events?.({ type: "semantic.index.error", payload: { message } });
      return this.storage.setSemanticIndexState({ state: "degraded", embeddingModel: config.model, lastError: message });
    }
  }
  async supersedeMissingPath(filePath2) {
    const existing = await this.storage.semanticRecords({ sourceId: filePath2, includeSuperseded: true, limit: 100 });
    for (const sourceType of new Set(existing.map((record) => record.sourceType))) await this.storage.supersedeSemanticSource(sourceType, filePath2, "missing", []);
  }
  async indexDurableState() {
    let embedded = 0;
    let sources = [];
    const present = /* @__PURE__ */ new Set();
    const flush = async () => {
      if (!sources.length) return;
      for (const result of await this.indexSources(sources)) embedded += result.embedded;
      sources = [];
    };
    const add = async (source) => {
      present.add(semanticSourceKey(source.sourceType, source.sourceId));
      sources.push(source);
      if (sources.length >= 32) await flush();
    };
    const project = await this.storage.dashboard();
    for (const task of project?.tasks ?? []) {
      const text = [task.title, task.description, task.progressSummary, task.resumeInstructions, ...task.steps.map((step) => `${step.name}: ${step.purpose}`), ...task.events.map((event) => event.summary), ...task.checkpoints.map((checkpoint) => checkpoint.summary)].filter(Boolean).join("\n");
      await add({ sourceType: "task", sourceId: task.id, revision: String(task.updatedAt), text, authority: 0.78, metadata: { taskId: task.id, branch: task.associatedBranch, status: task.status } });
    }
    for (const memory of await this.storage.listMemories(500, 2e5)) await add({ sourceType: memory.type, sourceId: memory.id, revision: String(memory.updatedAt), text: `${memory.title ?? ""}
${memory.content}`, metadata: { memoryId: memory.id } });
    for (const thread of await this.storage.listConversationThreads()) {
      const messages = await this.storage.listConversationMessages(thread.id);
      const text = messages.slice(-20).map((message) => `${message.role}: ${message.content}`).join("\n\n");
      await add({ sourceType: "conversation", sourceId: thread.id, revision: String(thread.updatedAt), text, metadata: { conversationId: thread.id } });
    }
    for (const action of await this.storage.listActions()) {
      const text = `${action.toolName}: ${action.resultSummary}`;
      await add({ sourceType: "tool", sourceId: action.id, revision: String(action.timestamp), text, metadata: { taskId: action.taskId, success: action.success, toolName: action.toolName } });
    }
    await flush();
    const indexed = await this.storage.semanticRecords({ includeSuperseded: false, limit: 5e3 });
    const removed = /* @__PURE__ */ new Map();
    for (const record of indexed) {
      const durable = record.sourceType === "task" || typeof record.metadata.memoryId === "string" || typeof record.metadata.conversationId === "string" || typeof record.metadata.toolName === "string";
      const key = semanticSourceKey(record.sourceType, record.sourceId);
      if (durable && !present.has(key)) removed.set(key, record);
    }
    for (const record of removed.values()) await this.storage.supersedeSemanticSource(record.sourceType, record.sourceId, "missing", []);
    return embedded;
  }
}
function semanticSourceKey(sourceType, sourceId) {
  return `${sourceType}\0${sourceId}`;
}
class SemanticIndexCancelledError extends Error {
  constructor() {
    super("Semantic indexing cancelled.");
    this.name = "SemanticIndexCancelledError";
  }
}
function indexableFile(file) {
  return !isSensitiveOrGeneratedPath(file.path) && INDEXABLE_EXTENSIONS.has((file.extension ?? path.extname(file.path).slice(1)).toLowerCase());
}
function classifySource(filePath2) {
  const normalized = filePath2.toLowerCase();
  const extension = path.extname(normalized);
  if (/\.(?:json|jsonc|ya?ml|toml|ini|conf)$/.test(extension) || /(?:^|\/)package\.json$/.test(normalized)) return "configuration";
  if (/\.(?:md|markdown|txt)$/.test(extension)) return /(?:architecture|decision|adr)/.test(normalized) ? "architecture" : "documentation";
  return "source";
}
function relationship(record, options) {
  const metadata = record.metadata;
  if (options.taskId && metadata.taskId === options.taskId) return 1;
  if (options.paths?.some((candidate) => normalizePortablePath(String(metadata.path ?? record.sourceUri ?? "")) === normalizePortablePath(candidate))) return 0.9;
  if (options.branch && metadata.branch === options.branch) return 0.75;
  return 0.35;
}
function freshness(record, now) {
  const ageDays = Math.max(0, now - record.lastVerifiedAt) / 864e5;
  return Math.exp(-ageDays / 120);
}
function lifecyclePenalty(lifecycle, relevance) {
  if (lifecycle === "superseded") return relevance >= 0.92 ? 0.25 : 1;
  if (lifecycle === "archived") return relevance >= 0.9 ? 0.18 : 0.55;
  if (lifecycle === "stale") return relevance >= 0.88 ? 0.04 : 0.32;
  if (lifecycle === "aging") return 0.08;
  return 0;
}
class SemanticContextService {
  constructor(storage2, embeddings, configuration, events, workspace2) {
    this.storage = storage2;
    this.embeddings = embeddings;
    this.configuration = configuration;
    this.events = events;
    this.workspace = workspace2;
  }
  lastHealth = { tokensUsed: 0, tokenBudget: DEFAULT_CONTEXT_TOKEN_BUDGET, relevance: 0, freshness: 0, authority: 0, redundancy: 0, staleRatio: 0, recordsConsidered: 0, recordsSelected: 0, sourceDistribution: {}, degraded: true, fallbackReason: "No context packet has been assembled." };
  health() {
    return structuredClone(this.lastHealth);
  }
  skip(reason2, tokenBudget = DEFAULT_SEMANTIC_TOKEN_BUDGET) {
    this.lastHealth = metricsFor([], 0, Math.min(tokenBudget, DEFAULT_SEMANTIC_TOKEN_BUDGET), 0, false, reason2);
    return this.health();
  }
  async searchSemanticContext(query, options = {}) {
    const config = await this.configuration();
    const tokenBudget = Math.min(Math.max(options.tokenBudget ?? DEFAULT_SEMANTIC_TOKEN_BUDGET, 1), DEFAULT_SEMANTIC_TOKEN_BUDGET);
    if (!config.enabled) {
      const fallbackReason2 = "Semantic context is disabled; direct workspace evidence remains available.";
      this.lastHealth = metricsFor([], 0, tokenBudget, 0, false, fallbackReason2);
      return { candidates: [], considered: 0, degraded: false, fallbackReason: fallbackReason2 };
    }
    const status = await this.storage.semanticIndexStatus();
    if (status.state !== "ready" || status.embeddingModel !== config.model) {
      const fallbackReason2 = status.lastError || `Semantic index is ${status.state}; direct workspace evidence remains authoritative.`;
      this.lastHealth = metricsFor([], 0, tokenBudget, 0, true, fallbackReason2);
      await this.events?.({ type: "semantic.fallback", payload: { reason: fallbackReason2 } });
      return { candidates: [], considered: 0, degraded: true, fallbackReason: fallbackReason2 };
    }
    let queryVector;
    try {
      queryVector = await this.embeddings.withModelSession(async () => (await this.embeddings.embed([query]))[0]);
    } catch (error) {
      const fallbackReason2 = error instanceof Error ? error.message : String(error);
      this.lastHealth = metricsFor([], 0, tokenBudget, 0, true, fallbackReason2);
      await this.events?.({ type: "semantic.fallback", payload: { reason: fallbackReason2 } });
      return { candidates: [], considered: 0, degraded: true, fallbackReason: fallbackReason2 };
    }
    const records = await this.storage.semanticRecords({ embeddingModel: config.model, includeSuperseded: false, limit: MAX_SEMANTIC_CANDIDATES });
    const filtered = options.sourceTypes?.length ? records.filter((record) => options.sourceTypes.includes(record.sourceType)) : records;
    const compatible = filtered.filter((record) => record.embeddingDimensions === queryVector.length);
    const fallbackReason = compatible.length !== filtered.length ? "Incompatible vector dimensions were excluded; rebuild the semantic index." : void 0;
    const now = Date.now();
    const candidates = compatible.map((record) => {
      const semanticRelevance = bounded((cosineSimilarity(queryVector, record.embedding) + 1) / 2);
      const taskRelationship = relationship(record, options);
      const authority = bounded(record.authorityScore);
      const fresh = freshness(record, now);
      const priorUsefulness = Math.min(1, Math.log1p(record.usageCount) / Math.log(16));
      const stalenessPenalty = lifecyclePenalty(record.lifecycle, semanticRelevance);
      const supersessionPenalty = record.lifecycle === "superseded" && semanticRelevance < 0.92 ? 1 : 0;
      const raw = semanticRelevance * GOVERNOR_WEIGHTS.semanticRelevance + taskRelationship * GOVERNOR_WEIGHTS.taskRelationship + authority * GOVERNOR_WEIGHTS.authority * (options.authorityPreference ?? 1) + fresh * GOVERNOR_WEIGHTS.freshness * (options.freshnessPreference ?? 1) + priorUsefulness * GOVERNOR_WEIGHTS.priorUsefulness - stalenessPenalty * GOVERNOR_WEIGHTS.stalenessPenalty - supersessionPenalty * GOVERNOR_WEIGHTS.supersessionPenalty;
      return { record, score: { semanticRelevance, taskRelationship, authority, freshness: fresh, priorUsefulness, stalenessPenalty, redundancyPenalty: 0, supersessionPenalty, finalScore: bounded(raw) }, estimatedTokens: estimateTokens(record.text), retrievalMode: "semantic" };
    }).filter((candidate) => candidate.score.finalScore >= (options.minimumScore ?? 0.32) && candidate.score.supersessionPenalty < 1).sort((a, b) => b.score.finalScore - a.score.finalScore || b.record.lastVerifiedAt - a.record.lastVerifiedAt);
    const deduplicated = [];
    let redundant = 0;
    for (const candidate of candidates) {
      const duplicate = deduplicated.some((selected2) => selected2.record.sourceId === candidate.record.sourceId || selected2.record.contentHash === candidate.record.contentHash || selected2.record.sourceId === candidate.record.sourceId && rangesOverlap(selected2.record, candidate.record) || selected2.record.embeddingDimensions === candidate.record.embeddingDimensions && cosineSimilarity(selected2.record.embedding, candidate.record.embedding) > 0.985);
      if (duplicate) {
        candidate.score.redundancyPenalty = 1;
        redundant += 1;
        continue;
      }
      deduplicated.push(candidate);
    }
    const resultLimit = Math.min(Math.max(options.limit ?? DEFAULT_SEMANTIC_RESULT_LIMIT, 1), MAX_SEMANTIC_RESULT_LIMIT);
    const selected = [];
    let used = 0;
    for (const candidate of deduplicated) {
      if (selected.length >= resultLimit) break;
      if (used + candidate.estimatedTokens > tokenBudget || !await this.isCurrent(candidate.record)) continue;
      selected.push(candidate);
      used += candidate.estimatedTokens;
    }
    this.lastHealth = metricsFor(selected, filtered.length, tokenBudget, redundant, Boolean(fallbackReason), fallbackReason);
    await this.events?.({ type: "semantic.retrieval", payload: { candidateCount: filtered.length, selectedCount: selected.length, tokensUsed: used, fallback: Boolean(fallbackReason) } });
    return { candidates: selected, considered: filtered.length, degraded: Boolean(fallbackReason), fallbackReason };
  }
  async isCurrent(record) {
    const sourcePath = typeof record.metadata.path === "string" ? record.metadata.path : void 0;
    if (!sourcePath || !this.workspace || !["source", "configuration", "documentation", "architecture"].includes(record.sourceType)) return !["stale", "archived", "superseded"].includes(record.lifecycle);
    const metadata = await this.workspace.metadata(sourcePath).catch(() => null);
    const indexedModifiedAt = Number(record.metadata.modifiedAt);
    const indexedSize = Number(record.metadata.size);
    const current = Boolean(metadata && metadata.modifiedAt === indexedModifiedAt && (!Number.isFinite(indexedSize) || metadata.size === indexedSize));
    if (!current) await this.events?.({ type: "semantic.stale.detected", payload: { sourceId: record.sourceId, sourceUri: record.sourceUri } });
    return current;
  }
}
function rangesOverlap(left, right) {
  if (left.lineStart === void 0 || left.lineEnd === void 0 || right.lineStart === void 0 || right.lineEnd === void 0) return false;
  const intersection = Math.max(0, Math.min(left.lineEnd, right.lineEnd) - Math.max(left.lineStart, right.lineStart) + 1);
  return intersection / Math.max(1, Math.min(left.lineEnd - left.lineStart + 1, right.lineEnd - right.lineStart + 1)) > 0.6;
}
function metricsFor(selected, considered, tokenBudget, redundant, degraded, fallbackReason) {
  const average = (selector) => selected.length ? selected.reduce((sum, candidate) => sum + selector(candidate), 0) / selected.length : 0;
  const sourceDistribution = {};
  for (const candidate of selected) sourceDistribution[candidate.record.sourceType] = (sourceDistribution[candidate.record.sourceType] ?? 0) + 1;
  return { tokensUsed: selected.reduce((sum, candidate) => sum + candidate.estimatedTokens, 0), tokenBudget, relevance: average((candidate) => candidate.score.semanticRelevance), freshness: average((candidate) => candidate.score.freshness), authority: average((candidate) => candidate.score.authority), redundancy: considered ? redundant / considered : 0, staleRatio: selected.length ? selected.filter((candidate) => ["stale", "archived", "superseded"].includes(candidate.record.lifecycle)).length / selected.length : 0, recordsConsidered: considered, recordsSelected: selected.length, sourceDistribution, degraded, fallbackReason };
}
const DEFAULT_CONTEXT_BUDGET = 28e3;
const DOCUMENT_PATTERN = /(?:^|\/)(?:readme|architecture|project[_-]?status|roadmap|dev[_-]?log|release[_-]?notes|goals?|memory)\.md$/i;
class PriorityContextBudgetPolicy {
  select(artifacts, characterBudget) {
    const ordered = [...artifacts].sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
    const selected = [];
    const omittedArtifactIds = [];
    let remaining = characterBudget;
    for (const artifact of ordered) {
      if (remaining <= 0) {
        omittedArtifactIds.push(artifact.id);
        continue;
      }
      const allowance = Math.min(artifact.content.length, 4e3, remaining);
      if (allowance <= 0) {
        omittedArtifactIds.push(artifact.id);
        continue;
      }
      const content = artifact.content.length > allowance ? `${artifact.content.slice(0, Math.max(0, allowance - 1))}…` : artifact.content;
      selected.push({ ...artifact, content });
      remaining -= content.length;
      if (content.length < artifact.content.length) omittedArtifactIds.push(`${artifact.id}:truncated`);
    }
    return { selected, omittedArtifactIds };
  }
}
class WorkspaceContextEngine {
  constructor(workspace2, git2, storage2, budgetPolicy = new PriorityContextBudgetPolicy(), semantic) {
    this.workspace = workspace2;
    this.git = git2;
    this.storage = storage2;
    this.budgetPolicy = budgetPolicy;
    this.semantic = semantic;
  }
  tokenBudget = DEFAULT_CONTEXT_TOKEN_BUDGET;
  useSemanticContext(service) {
    this.semantic = service;
  }
  setTokenBudget(value) {
    this.tokenBudget = Math.min(128e3, Math.max(4e3, Math.round(value)));
  }
  flattenFiles(nodes) {
    const out = [];
    for (const node of nodes) {
      out.push({ path: node.relativePath || node.path, type: node.type, extension: node.extension });
      if (node.children?.length) out.push(...this.flattenFiles(node.children));
    }
    return out;
  }
  async buildContext(query = "", memories) {
    const context = { projectName: null, rootPath: null, files: [], documents: [], sourceFiles: [], packageJson: null, gitStatus: null, recentCommits: null, metadata: null, memories: memories ?? null };
    try {
      const info = this.workspace.info();
      if (info) {
        context.projectName = info.name ?? null;
        context.rootPath = info.rootPath ?? null;
      }
    } catch {
    }
    try {
      context.files = this.flattenFiles(await this.workspace.list(""));
    } catch {
      context.files = [];
    }
    const candidatePaths = [...new Set(context.files.filter((file) => file.type === "file" && DOCUMENT_PATTERN.test(file.path)).map((file) => file.path))].slice(0, 10);
    for (const documentPath of candidatePaths) {
      try {
        const file = await this.workspace.readFile(documentPath);
        context.documents.push({ path: documentPath, content: file.content });
      } catch {
      }
    }
    try {
      const packageJson = await this.workspace.readFile("package.json");
      context.packageJson = { path: packageJson.path, content: packageJson.content };
    } catch {
    }
    try {
      context.gitStatus = await this.git.status();
    } catch {
    }
    try {
      const commits = await this.git.log(12);
      context.recentCommits = commits.map((commit) => ({ hash: commit.hash, message: commit.message, author: commit.author, timestamp: commit.timestamp }));
    } catch {
    }
    try {
      context.metadata = await this.storage.dashboard();
    } catch {
    }
    const queryTokens = new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
    const changedPaths = new Set(context.gitStatus && typeof context.gitStatus === "object" && "files" in context.gitStatus && Array.isArray(context.gitStatus.files) ? context.gitStatus.files.map((file) => String(file.path ?? "")) : []);
    const sourceExtensions = /* @__PURE__ */ new Set(["ts", "tsx", "js", "jsx", "py", "c", "cpp", "rs", "go", "java"]);
    const sourceCandidates = context.files.filter((file) => file.type === "file" && sourceExtensions.has(file.extension?.toLowerCase() ?? "")).map((file) => ({ path: file.path, changed: changedPaths.has(file.path), score: (changedPaths.has(file.path) ? 100 : 0) + [...queryTokens].reduce((score, token) => score + (file.path.toLowerCase().includes(token) ? 10 : 0), 0) })).filter((candidate) => candidate.changed || candidate.score > 0).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, 6);
    for (const candidate of sourceCandidates) {
      try {
        const file = await this.workspace.readFile(candidate.path);
        context.sourceFiles.push({ path: candidate.path, content: file.content, changed: candidate.changed, relevance: candidate.changed ? 96 : 84, reason: candidate.changed ? "Changed implementation file." : "Source path matches the current question." });
      } catch {
      }
    }
    return context;
  }
  async assemble(query, memories, characterBudget = DEFAULT_CONTEXT_BUDGET) {
    characterBudget = Math.min(characterBudget, this.tokenBudget * 4);
    const context = await this.buildContext(query, memories);
    const artifacts = [];
    const add = (artifact) => {
      if (artifact.content.trim()) artifacts.push(artifact);
    };
    add({ id: "workspace-inventory", kind: "source", title: "Workspace inventory", priority: 60, content: `${context.files.length} indexed entries
${context.files.slice(0, 180).map((file) => `${file.type === "directory" ? "dir" : "file"}: ${file.path}`).join("\n")}`, metadata: { relevance: 70, reason: "Workspace identity and file inventory." } });
    for (const document of context.documents) add({ id: `document:${document.path}`, kind: /(?:architecture|project[_-]?status|roadmap|dev[_-]?log|release[_-]?notes)/i.test(document.path) ? "architecture" : "documentation", title: document.path, path: document.path, content: document.content, priority: /architecture/i.test(document.path) ? 82 : /^readme/i.test(document.path) ? 78 : 74, metadata: { relevance: 90, reason: "Current workspace documentation selected by deterministic context policy." } });
    for (const sourceFile of context.sourceFiles) add({ id: `source:${sourceFile.path}`, kind: "source", title: sourceFile.path, path: sourceFile.path, content: sourceFile.content, priority: sourceFile.changed ? 98 : 96, metadata: { relevance: sourceFile.relevance, reason: sourceFile.reason } });
    if (context.packageJson) add({ id: "package-json", kind: "configuration", title: "package.json", path: context.packageJson.path, content: context.packageJson.content, priority: 90 });
    if (context.gitStatus) add({ id: "git-status", kind: "git", title: "Current Git state", content: JSON.stringify(context.gitStatus, null, 2), priority: 94 });
    if (context.recentCommits?.length) add({ id: "git-history", kind: "git", title: "Recent Git history", content: context.recentCommits.map((commit) => `${commit.hash.slice(0, 8)} ${commit.message}`).join("\n"), priority: 92 });
    if (context.metadata) add({ id: "project-metadata", kind: "metadata", title: "Current project goals, tasks, and runtime metadata", content: JSON.stringify(context.metadata, null, 2), priority: 88 });
    for (const memory of context.memories ?? []) add({ id: `memory:${memory.id}`, kind: "memory", title: memory.title || memory.type, content: memory.content, priority: memory.type === "decision" ? 54 : 50, updatedAt: memory.updatedAt, metadata: { relevance: memory.relevance ?? 80, reason: memory.reasons?.join(" · ") ?? "Durable historical workspace knowledge; current source and tool evidence take precedence." } });
    let metrics = this.semantic?.health() ?? { redundancy: 0, degraded: true, fallbackReason: "Semantic context has not been initialized." };
    if (this.semantic && shouldUseSemanticRetrieval(query, context)) {
      const retrieval = await this.semantic.searchSemanticContext(query, { limit: DEFAULT_SEMANTIC_RESULT_LIMIT, tokenBudget: Math.min(DEFAULT_SEMANTIC_TOKEN_BUDGET, Math.floor(this.tokenBudget * 0.2)) });
      metrics = this.semantic.health();
      for (const candidate of retrieval.candidates) {
        const record = candidate.record;
        add({ id: `semantic:${record.id}`, kind: semanticArtifactKind(record.sourceType), title: record.sourceUri ?? record.sourceId, path: record.sourceUri, content: record.text, priority: Math.min(58, 28 + Math.round(candidate.score.finalScore * 30)), updatedAt: record.updatedAt, metadata: { semanticRecordId: record.id, sourceType: record.sourceType, sourceRevision: record.sourceRevision, lineStart: record.lineStart, lineEnd: record.lineEnd, lifecycle: record.lifecycle, relevance: Math.round(candidate.score.semanticRelevance * 100), authority: candidate.score.authority, freshness: candidate.score.freshness, finalScore: candidate.score.finalScore, retrievalMode: candidate.retrievalMode, reason: `${candidate.retrievalMode} discovery evidence; current files, Git, task state, and direct Tool Results remain authoritative.` } });
      }
    } else if (this.semantic) metrics = this.semantic.skip("Semantic retrieval was not needed; deterministic workspace evidence and direct tools have priority.");
    const budgeted = this.budgetPolicy.select(artifacts, characterBudget);
    const evidence = budgeted.selected.map((artifact) => `## ${artifact.title}${artifact.path ? ` (${artifact.path})` : ""}
${artifact.content}`).join("\n\n");
    const projectName = context.projectName ?? "the active workspace";
    const systemPrompt = `You are consuming context compiled by FORGE for the repository "${projectName}".

FORGE owns workspace intelligence: project evidence, durable memory, task state, Git chronology, terminal observations, and relevance filtering. The active LLM or CLI agent owns reasoning and execution. Treat the project folder as authority and distinguish evidence from inference.

Evidence authority, highest first: (1) explicit files or tools requested by the user, (2) direct current source-code Tool Results, (3) current Git state/history/diff, (4) current task/runtime state, (5) semantic discovery, (6) durable historical memory, (7) model prior knowledge. Semantic context is a discovery hint, never proof and never a substitute for tool use. When the user asks to read/search/inspect the workspace, use the corresponding direct tool. A file.search result identifies candidates; read the relevant implementation with file.read, trace callers, inspect relevant tests and Git evidence, then conclude.

Workspace evidence for this turn:
${evidence || "No workspace evidence was available."}`;
    return { systemPrompt, artifacts: budgeted.selected, omittedArtifactIds: budgeted.omittedArtifactIds, characterBudget, characterCount: systemPrompt.length, tokenBudget: this.tokenBudget, tokenCount: estimateTokens(systemPrompt), metrics: packetMetrics(budgeted.selected, artifacts.length, estimateTokens(systemPrompt), this.tokenBudget, metrics) };
  }
  async envelope(query, memories, characterBudget) {
    const compiled = await this.assemble(query, memories, characterBudget);
    return { ...compiled, query, generatedAt: Date.now() };
  }
}
const AUTHORITY_BY_KIND = Object.freeze({
  identity: 1,
  configuration: 0.96,
  source: 0.94,
  git: 0.9,
  architecture: 0.86,
  documentation: 0.82,
  metadata: 0.78,
  memory: 0.72,
  terminal: 0.66,
  conversation: 0.48
});
function normalizedMetric(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(1, Math.max(0, numeric > 1 ? numeric / 100 : numeric));
}
function packetMetrics(selected, considered, tokensUsed, tokenBudget, semantic) {
  const average = (selector) => selected.length ? selected.reduce((sum, artifact) => sum + selector(artifact), 0) / selected.length : 0;
  const now = Date.now();
  const sourceDistribution = {};
  for (const artifact of selected) sourceDistribution[artifact.kind] = (sourceDistribution[artifact.kind] ?? 0) + 1;
  return {
    tokensUsed,
    tokenBudget,
    relevance: average((artifact) => normalizedMetric(artifact.metadata?.relevance, 0.75)),
    freshness: average((artifact) => normalizedMetric(artifact.metadata?.freshness, artifact.updatedAt ? Math.exp(-Math.max(0, now - artifact.updatedAt) / (120 * 864e5)) : 1)),
    authority: average((artifact) => normalizedMetric(artifact.metadata?.authority, AUTHORITY_BY_KIND[artifact.kind])),
    redundancy: semantic.redundancy,
    staleRatio: selected.length ? selected.filter((artifact) => ["stale", "archived", "superseded"].includes(String(artifact.metadata?.lifecycle ?? ""))).length / selected.length : 0,
    recordsConsidered: considered,
    recordsSelected: selected.length,
    sourceDistribution,
    degraded: semantic.degraded,
    fallbackReason: semantic.fallbackReason
  };
}
function shouldUseSemanticRetrieval(query, context) {
  const normalized = query.trim().toLowerCase();
  if (!normalized || context.sourceFiles.length > 0) return false;
  if (/^(?:continue the original request|every requested tool call)/.test(normalized)) return false;
  if (/\b(?:file\.(?:read|search)|git\.(?:log|diff|status)|read (?:this|the) file|use (?:agent |workspace )?tools?|inspect (?:the )?(?:workspace|repository|source|file)|current (?:source|git|diff)|stack trace|exact error|diagnos\w*|debug\w*|regression|bug|crash|failure)\b/.test(normalized)) return false;
  return /\b(?:explain|overview|architecture|concept|relationship|relate|historical|why does|how does|where is|discover|find related)\b/.test(normalized);
}
function semanticArtifactKind(sourceType) {
  if (["source"].includes(sourceType)) return "source";
  if (["configuration"].includes(sourceType)) return "configuration";
  if (["documentation"].includes(sourceType)) return "documentation";
  if (["architecture", "decision"].includes(sourceType)) return "architecture";
  if (sourceType === "conversation") return "conversation";
  if (sourceType === "git") return "git";
  if (["memory", "note"].includes(sourceType)) return "memory";
  return "metadata";
}
class WorkspaceIntelligenceService {
  constructor(context, observations) {
    this.context = context;
    this.observations = observations;
  }
  invalidatedAt;
  invalidationRevision = 0;
  packetRevision = -1;
  invalidationReasons = /* @__PURE__ */ new Set();
  latestPacket = null;
  async invalidate(reason2, payload = {}) {
    this.invalidatedAt = Date.now();
    this.invalidationRevision += 1;
    this.invalidationReasons.add(reason2);
    await this.observations?.recordProjectObservation(reason2, payload);
  }
  async assemble(query, memories, characterBudget) {
    return this.context.assemble(query, memories, characterBudget);
  }
  async packet(query, memories, characterBudget) {
    const revision = this.invalidationRevision;
    const compiled = await this.assemble(query, memories, characterBudget);
    const projectObservations = await this.observations?.listProjectObservations() ?? [];
    const observationContent = projectObservations.length ? JSON.stringify(projectObservations, null, 2).slice(0, 8e3) : "";
    const artifact = observationContent ? { id: "project-observations", kind: "metadata", title: "Fresh project observations", content: observationContent, priority: 99, updatedAt: projectObservations[0]?.timestamp, metadata: { relevance: 99, reason: "Durable observations invalidate stale cached context." } } : null;
    const systemPrompt = artifact ? `${compiled.systemPrompt}

## ${artifact.title}
${artifact.content}` : compiled.systemPrompt;
    const packet = { ...compiled, systemPrompt, artifacts: artifact ? [artifact, ...compiled.artifacts] : compiled.artifacts, characterCount: systemPrompt.length, tokenCount: Math.ceil(systemPrompt.length / 4), metrics: { ...compiled.metrics, tokensUsed: Math.ceil(systemPrompt.length / 4) }, query, generatedAt: Date.now(), invalidatedAt: this.invalidatedAt, invalidationReasons: [...this.invalidationReasons], projectObservations };
    this.latestPacket = packet;
    this.packetRevision = revision;
    this.invalidationReasons.clear();
    return packet;
  }
  /** Returns the actual most-recent agent packet, rebuilding a baseline packet after invalidation. */
  async snapshot(memories) {
    if (this.latestPacket && this.packetRevision === this.invalidationRevision) return structuredClone(this.latestPacket);
    return this.packet("", memories);
  }
}
const EXCLUDED_PATH_PARTS = /* @__PURE__ */ new Set([".git", ".forge", ".obsidian", "node_modules", "dist_electron", "out", "coverage", "build", ".next", "__pycache__"]);
const SOURCE_EXTENSIONS = /* @__PURE__ */ new Set(["ts", "tsx", "js", "jsx", "py", "java", "c", "cpp", "h", "rs", "go"]);
const CONFIGURATION_NAMES = /^(?:package(?:-lock)?\.json|tsconfig(?:\.[^.]+)?\.json|vitest\.config\.[^.]+|vite\.config\.[^.]+|electron\.vite\.config\.[^.]+|eslint\.config\.[^.]+|\.env\.example)$/i;
const ARCHITECTURE_NAMES = /^(?:readme|architecture|project[_-]?status|roadmap|dev[_-]?log|release[_-]?notes|goals?|memory)(?:\.[^.]+)?\.md$/i;
function classifyWorkspaceKnowledge(path2, extension) {
  const normalized = path2.replaceAll("\\", "/");
  const parts = normalized.toLowerCase().split("/");
  if (parts.some((part) => EXCLUDED_PATH_PARTS.has(part))) return null;
  const name = parts.at(-1) ?? "";
  const ext = (extension || name.split(".").at(-1) || "").toLowerCase();
  if (ARCHITECTURE_NAMES.test(name) || parts.includes("architecture")) {
    return { type: "architecture", label: "Architecture", reason: "Defines project intent, architecture, status, or durable direction." };
  }
  if (ext === "md" || ext === "txt") {
    return { type: "documentation", label: "Documentation", reason: "Human-authored project documentation." };
  }
  if (CONFIGURATION_NAMES.test(name) || ["json", "yml", "yaml"].includes(ext)) {
    return { type: "configuration", label: "Configuration", reason: "Build, tooling, or project configuration." };
  }
  if (SOURCE_EXTENSIONS.has(ext)) {
    return { type: "source", label: "Source Code", reason: "Current implementation source." };
  }
  return null;
}
class MemoryService {
  constructor(storage2) {
    this.storage = storage2;
  }
  async create(entry) {
    return this.storage.createMemory(entry.type, entry.title ?? null, entry.content, entry.metadata);
  }
  async list(limit = 100, contentLimit = 12e3) {
    return this.storage.listMemories(limit, contentLimit);
  }
  async update(id2, fields) {
    return this.storage.updateMemory(id2, fields);
  }
  async delete(id2) {
    return this.storage.deleteMemory(id2);
  }
}
class MemoryRetriever {
  constructor(memoryService2) {
    this.memoryService = memoryService2;
  }
  tokenize(text) {
    const stopWords = /* @__PURE__ */ new Set(["a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "i", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "what", "when", "where", "which", "who", "why", "with"]);
    return text.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 1 && !stopWords.has(token));
  }
  // TF-IDF based scoring with optional metadata weighting and recency bonus
  async search(query, limit = 10) {
    const asksForObsidian = /\bobsidian\b/i.test(query);
    const asksForConfiguration = /\b(?:config|configuration|build|tooling|package|typescript|test|vitest|eslint|vite)\b/i.test(query);
    const scoringLimit = 24e3;
    const entries = (await this.memoryService.list(500, scoringLimit)).filter((entry) => {
      const metadata = typeof entry.metadata === "object" && entry.metadata ? entry.metadata : {};
      const sourcePath = String(metadata.path ?? "");
      if (/(?:^|\/)\.obsidian(?:\/|$)/i.test(sourcePath) && !asksForObsidian) return false;
      if ((metadata.classification === "Configuration" || entry.type === "configuration" || /(?:\.json|\.ya?ml|(?:^|\/)\w+\.config\.[^/]+)$/i.test(sourcePath)) && !asksForConfiguration && !asksForObsidian) return false;
      return true;
    });
    const now = Date.now();
    const returnedLimit = 12e3;
    const docs = entries.map((e) => ({ id: e.id, type: e.type, title: e.title ?? "", content: String(e.content ?? ""), metadata: e.metadata, createdAt: e.createdAt || 0, updatedAt: e.updatedAt || e.createdAt || 0 }));
    const N = docs.length || 1;
    const docTokens = docs.map((d) => this.tokenize(d.title + " " + d.content));
    const df = {};
    for (const toks of docTokens) {
      const seen = /* @__PURE__ */ new Set();
      for (const t of toks) {
        if (!seen.has(t)) {
          seen.add(t);
          df[t] = (df[t] || 0) + 1;
        }
      }
    }
    const idf = {};
    for (const [t, f] of Object.entries(df)) idf[t] = Math.log(1 + N / (1 + f));
    const qTokens = this.tokenize(query);
    const qFreq = {};
    for (const t of qTokens) qFreq[t] = (qFreq[t] || 0) + 1;
    const scores = docs.map((d, i) => {
      const tf = {};
      for (const t of docTokens[i]) tf[t] = (tf[t] || 0) + 1;
      let score = 0;
      let titleMatches = 0;
      let tagMatches = 0;
      const matchedTokens = /* @__PURE__ */ new Set();
      for (const qt of Object.keys(qFreq)) {
        const wIdf = idf[qt] ?? Math.log(1 + N);
        const docTf = tf[qt] ?? 0;
        score += docTf * wIdf * qFreq[qt];
        if (docTf > 0) matchedTokens.add(qt);
        if (d.title.toLowerCase().includes(qt)) {
          score += 2 * wIdf;
          titleMatches += 1;
          matchedTokens.add(qt);
        }
      }
      if (d.metadata && d.metadata.tags) {
        const tags = d.metadata.tags.map((t) => String(t).toLowerCase());
        for (const qt of Object.keys(qFreq)) if (tags.includes(qt)) {
          score += 3;
          tagMatches += 1;
          matchedTokens.add(qt);
        }
      }
      if (matchedTokens.size === 0) return null;
      const ageDays = Math.max(0, (now - (d.createdAt || 0)) / (1e3 * 60 * 60 * 24));
      const recency = Math.max(0, 1.5 - ageDays / 45);
      score += recency;
      const coverage = matchedTokens.size / Math.max(1, Object.keys(qFreq).length);
      const relevance = Math.min(99, Math.round(45 + coverage * 35 + Math.min(12, titleMatches * 6) + Math.min(7, tagMatches * 4)));
      const reasons = [
        `${matchedTokens.size}/${Math.max(1, Object.keys(qFreq).length)} query concepts matched`,
        titleMatches ? `${titleMatches} title match${titleMatches === 1 ? "" : "es"}` : "",
        tagMatches ? `${tagMatches} tag match${tagMatches === 1 ? "" : "es"}` : ""
      ].filter(Boolean);
      return { entry: d, score, relevance, reasons };
    }).filter((entry) => Boolean(entry && entry.relevance >= 55));
    scores.sort((a, b) => b.relevance - a.relevance || b.score - a.score);
    return scores.slice(0, limit).map((result) => ({
      id: result.entry.id,
      workspaceId: "",
      type: result.entry.type,
      title: result.entry.title || null,
      content: result.entry.content.slice(0, returnedLimit),
      metadata: { ...typeof result.entry.metadata === "object" && result.entry.metadata ? result.entry.metadata : {}, relevance: result.relevance, reasons: result.reasons },
      createdAt: result.entry.createdAt,
      updatedAt: result.entry.updatedAt,
      relevance: result.relevance,
      reasons: result.reasons
    }));
  }
}
class MemoryIndexer {
  constructor(memoryService2, workspace2) {
    this.memoryService = memoryService2;
    this.workspace = workspace2;
  }
  async indexConversations(_limit = 100) {
    return;
  }
  async indexWorkspaceFiles(limitPerType = 200) {
    const files = await this.workspace.list();
    const all = [];
    const walk = (nodes) => {
      for (const n of nodes) {
        if (n.type === "file") all.push(n);
        if (n.children) walk(n.children);
      }
    };
    walk(files);
    const existing = await this.memoryService.list(2e3, 0);
    const indexed = existing.filter((entry) => {
      const metadata = typeof entry.metadata === "object" && entry.metadata ? entry.metadata : {};
      return metadata.origin === "workspace-index" || ["document", "code"].includes(entry.type) && typeof metadata.path === "string";
    });
    const byPath = /* @__PURE__ */ new Map();
    for (const entry of indexed) {
      const sourcePath = String(entry.metadata.path);
      byPath.set(sourcePath, [...byPath.get(sourcePath) ?? [], entry]);
    }
    const classified = all.map((file) => ({ file, sourcePath: file.relativePath || file.path, classification: classifyWorkspaceKnowledge(file.relativePath || file.path, file.extension) })).filter((entry) => Boolean(entry.classification));
    const eligiblePaths = new Set(classified.map((entry) => entry.sourcePath));
    for (const entry of indexed) {
      const sourcePath = String(entry.metadata.path);
      if (!eligiblePaths.has(sourcePath)) await this.memoryService.delete(entry.id);
    }
    let count = 0;
    for (const { file: f, sourcePath, classification } of classified) {
      if (count >= limitPerType) break;
      try {
        const fc = await this.workspace.readFile(sourcePath);
        const indexedContent = fc.content.slice(0, 12e4);
        const metadata = { origin: "workspace-index", path: sourcePath, classification: classification.label, reason: classification.reason, truncated: indexedContent.length < fc.content.length };
        const matches = byPath.get(sourcePath) ?? [];
        if (matches[0]) {
          await this.memoryService.update(matches[0].id, { type: classification.type, title: f.name, content: indexedContent, metadata });
          for (const duplicate of matches.slice(1)) await this.memoryService.delete(duplicate.id);
        } else {
          await this.memoryService.create({ type: classification.type, title: f.name, content: indexedContent, metadata });
        }
        count += 1;
      } catch {
      }
    }
    return { indexed: count, excluded: all.length - classified.length };
  }
}
var re = { exports: {} };
var constants;
var hasRequiredConstants;
function requireConstants() {
  if (hasRequiredConstants) return constants;
  hasRequiredConstants = 1;
  const SEMVER_SPEC_VERSION = "2.0.0";
  const MAX_LENGTH = 256;
  const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
  9007199254740991;
  const MAX_SAFE_COMPONENT_LENGTH = 16;
  const MAX_SAFE_BUILD_LENGTH = MAX_LENGTH - 6;
  const RELEASE_TYPES = [
    "major",
    "premajor",
    "minor",
    "preminor",
    "patch",
    "prepatch",
    "prerelease"
  ];
  constants = {
    MAX_LENGTH,
    MAX_SAFE_COMPONENT_LENGTH,
    MAX_SAFE_BUILD_LENGTH,
    MAX_SAFE_INTEGER,
    RELEASE_TYPES,
    SEMVER_SPEC_VERSION,
    FLAG_INCLUDE_PRERELEASE: 1,
    FLAG_LOOSE: 2
  };
  return constants;
}
var debug_1;
var hasRequiredDebug;
function requireDebug() {
  if (hasRequiredDebug) return debug_1;
  hasRequiredDebug = 1;
  const debug = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {
  };
  debug_1 = debug;
  return debug_1;
}
var hasRequiredRe;
function requireRe() {
  if (hasRequiredRe) return re.exports;
  hasRequiredRe = 1;
  (function(module, exports) {
    const {
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_LENGTH
    } = requireConstants();
    const debug = requireDebug();
    exports = module.exports = {};
    const re2 = exports.re = [];
    const safeRe = exports.safeRe = [];
    const src = exports.src = [];
    const safeSrc = exports.safeSrc = [];
    const t = exports.t = {};
    let R = 0;
    const LETTERDASHNUMBER = "[a-zA-Z0-9-]";
    const safeRegexReplacements = [
      ["\\s", 1],
      ["\\d", MAX_LENGTH],
      [LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
    ];
    const makeSafeRegex = (value) => {
      for (const [token, max] of safeRegexReplacements) {
        value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
      }
      return value;
    };
    const createToken = (name, value, isGlobal) => {
      const safe = makeSafeRegex(value);
      const index = R++;
      debug(name, index, value);
      t[name] = index;
      src[index] = value;
      safeSrc[index] = safe;
      re2[index] = new RegExp(value, isGlobal ? "g" : void 0);
      safeRe[index] = new RegExp(safe, isGlobal ? "g" : void 0);
    };
    createToken("NUMERICIDENTIFIER", "0|[1-9]\\d*");
    createToken("NUMERICIDENTIFIERLOOSE", "\\d+");
    createToken("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);
    createToken("MAINVERSION", `(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})`);
    createToken("MAINVERSIONLOOSE", `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASEIDENTIFIER", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIER]})`);
    createToken("PRERELEASEIDENTIFIERLOOSE", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASE", `(?:-(${src[t.PRERELEASEIDENTIFIER]}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);
    createToken("PRERELEASELOOSE", `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);
    createToken("BUILDIDENTIFIER", `${LETTERDASHNUMBER}+`);
    createToken("BUILD", `(?:\\+(${src[t.BUILDIDENTIFIER]}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);
    createToken("FULLPLAIN", `v?${src[t.MAINVERSION]}${src[t.PRERELEASE]}?${src[t.BUILD]}?`);
    createToken("FULL", `^${src[t.FULLPLAIN]}$`);
    createToken("LOOSEPLAIN", `[v=\\s]*${src[t.MAINVERSIONLOOSE]}${src[t.PRERELEASELOOSE]}?${src[t.BUILD]}?`);
    createToken("LOOSE", `^${src[t.LOOSEPLAIN]}$`);
    createToken("GTLT", "((?:<|>)?=?)");
    createToken("XRANGEIDENTIFIERLOOSE", `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
    createToken("XRANGEIDENTIFIER", `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);
    createToken("XRANGEPLAIN", `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:${src[t.PRERELEASE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGEPLAINLOOSE", `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:${src[t.PRERELEASELOOSE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
    createToken("XRANGELOOSE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COERCEPLAIN", `${"(^|[^\\d])(\\d{1,"}${MAX_SAFE_COMPONENT_LENGTH}})(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
    createToken("COERCE", `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
    createToken("COERCEFULL", src[t.COERCEPLAIN] + `(?:${src[t.PRERELEASE]})?(?:${src[t.BUILD]})?(?:$|[^\\d])`);
    createToken("COERCERTL", src[t.COERCE], true);
    createToken("COERCERTLFULL", src[t.COERCEFULL], true);
    createToken("LONETILDE", "(?:~>?)");
    createToken("TILDETRIM", `(\\s*)${src[t.LONETILDE]}\\s+`, true);
    exports.tildeTrimReplace = "$1~";
    createToken("TILDE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
    createToken("TILDELOOSE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("LONECARET", "(?:\\^)");
    createToken("CARETTRIM", `(\\s*)${src[t.LONECARET]}\\s+`, true);
    exports.caretTrimReplace = "$1^";
    createToken("CARET", `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
    createToken("CARETLOOSE", `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COMPARATORLOOSE", `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
    createToken("COMPARATOR", `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);
    createToken("COMPARATORTRIM", `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
    exports.comparatorTrimReplace = "$1$2$3";
    createToken("HYPHENRANGE", `^\\s*(${src[t.XRANGEPLAIN]})\\s+-\\s+(${src[t.XRANGEPLAIN]})\\s*$`);
    createToken("HYPHENRANGELOOSE", `^\\s*(${src[t.XRANGEPLAINLOOSE]})\\s+-\\s+(${src[t.XRANGEPLAINLOOSE]})\\s*$`);
    createToken("STAR", "(<|>)?=?\\s*\\*");
    createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
    createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
  })(re, re.exports);
  return re.exports;
}
var parseOptions_1;
var hasRequiredParseOptions;
function requireParseOptions() {
  if (hasRequiredParseOptions) return parseOptions_1;
  hasRequiredParseOptions = 1;
  const looseOption = Object.freeze({ loose: true });
  const emptyOpts = Object.freeze({});
  const parseOptions = (options) => {
    if (!options) {
      return emptyOpts;
    }
    if (typeof options !== "object") {
      return looseOption;
    }
    return options;
  };
  parseOptions_1 = parseOptions;
  return parseOptions_1;
}
var identifiers;
var hasRequiredIdentifiers;
function requireIdentifiers() {
  if (hasRequiredIdentifiers) return identifiers;
  hasRequiredIdentifiers = 1;
  const numeric = /^[0-9]+$/;
  const compareIdentifiers = (a, b) => {
    if (typeof a === "number" && typeof b === "number") {
      return a === b ? 0 : a < b ? -1 : 1;
    }
    const anum = numeric.test(a);
    const bnum = numeric.test(b);
    if (anum && bnum) {
      a = +a;
      b = +b;
    }
    return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
  };
  const rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);
  identifiers = {
    compareIdentifiers,
    rcompareIdentifiers
  };
  return identifiers;
}
var semver$2;
var hasRequiredSemver$2;
function requireSemver$2() {
  if (hasRequiredSemver$2) return semver$2;
  hasRequiredSemver$2 = 1;
  const debug = requireDebug();
  const { MAX_LENGTH, MAX_SAFE_INTEGER } = requireConstants();
  const { safeRe: re2, t } = requireRe();
  const parseOptions = requireParseOptions();
  const { compareIdentifiers } = requireIdentifiers();
  const isPrereleaseIdentifier = (prerelease, identifier) => {
    const identifiers2 = identifier.split(".");
    if (identifiers2.length > prerelease.length) {
      return false;
    }
    for (let i = 0; i < identifiers2.length; i++) {
      if (compareIdentifiers(prerelease[i], identifiers2[i]) !== 0) {
        return false;
      }
    }
    return true;
  };
  class SemVer {
    constructor(version, options) {
      options = parseOptions(options);
      if (version instanceof SemVer) {
        if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) {
          return version;
        } else {
          version = version.version;
        }
      } else if (typeof version !== "string") {
        throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`);
      }
      if (version.length > MAX_LENGTH) {
        throw new TypeError(
          `version is longer than ${MAX_LENGTH} characters`
        );
      }
      debug("SemVer", version, options);
      this.options = options;
      this.loose = !!options.loose;
      this.includePrerelease = !!options.includePrerelease;
      const m = version.trim().match(options.loose ? re2[t.LOOSE] : re2[t.FULL]);
      if (!m) {
        throw new TypeError(`Invalid Version: ${version}`);
      }
      this.raw = version;
      this.major = +m[1];
      this.minor = +m[2];
      this.patch = +m[3];
      if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
        throw new TypeError("Invalid major version");
      }
      if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
        throw new TypeError("Invalid minor version");
      }
      if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
        throw new TypeError("Invalid patch version");
      }
      if (!m[4]) {
        this.prerelease = [];
      } else {
        this.prerelease = m[4].split(".").map((id2) => {
          if (/^[0-9]+$/.test(id2)) {
            const num = +id2;
            if (num >= 0 && num < MAX_SAFE_INTEGER) {
              return num;
            }
          }
          return id2;
        });
      }
      this.build = m[5] ? m[5].split(".") : [];
      this.format();
    }
    format() {
      this.version = `${this.major}.${this.minor}.${this.patch}`;
      if (this.prerelease.length) {
        this.version += `-${this.prerelease.join(".")}`;
      }
      return this.version;
    }
    toString() {
      return this.version;
    }
    compare(other) {
      debug("SemVer.compare", this.version, this.options, other);
      if (!(other instanceof SemVer)) {
        if (typeof other === "string" && other === this.version) {
          return 0;
        }
        other = new SemVer(other, this.options);
      }
      if (other.version === this.version) {
        return 0;
      }
      return this.compareMain(other) || this.comparePre(other);
    }
    compareMain(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      if (this.major < other.major) {
        return -1;
      }
      if (this.major > other.major) {
        return 1;
      }
      if (this.minor < other.minor) {
        return -1;
      }
      if (this.minor > other.minor) {
        return 1;
      }
      if (this.patch < other.patch) {
        return -1;
      }
      if (this.patch > other.patch) {
        return 1;
      }
      return 0;
    }
    comparePre(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      if (this.prerelease.length && !other.prerelease.length) {
        return -1;
      } else if (!this.prerelease.length && other.prerelease.length) {
        return 1;
      } else if (!this.prerelease.length && !other.prerelease.length) {
        return 0;
      }
      let i = 0;
      do {
        const a = this.prerelease[i];
        const b = other.prerelease[i];
        debug("prerelease compare", i, a, b);
        if (a === void 0 && b === void 0) {
          return 0;
        } else if (b === void 0) {
          return 1;
        } else if (a === void 0) {
          return -1;
        } else if (a === b) {
          continue;
        } else {
          return compareIdentifiers(a, b);
        }
      } while (++i);
    }
    compareBuild(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      let i = 0;
      do {
        const a = this.build[i];
        const b = other.build[i];
        debug("build compare", i, a, b);
        if (a === void 0 && b === void 0) {
          return 0;
        } else if (b === void 0) {
          return 1;
        } else if (a === void 0) {
          return -1;
        } else if (a === b) {
          continue;
        } else {
          return compareIdentifiers(a, b);
        }
      } while (++i);
    }
    // preminor will bump the version up to the next minor release, and immediately
    // down to pre-release. premajor and prepatch work the same way.
    inc(release2, identifier, identifierBase) {
      if (release2.startsWith("pre")) {
        if (!identifier && identifierBase === false) {
          throw new Error("invalid increment argument: identifier is empty");
        }
        if (identifier) {
          const match = `-${identifier}`.match(this.options.loose ? re2[t.PRERELEASELOOSE] : re2[t.PRERELEASE]);
          if (!match || match[1] !== identifier) {
            throw new Error(`invalid identifier: ${identifier}`);
          }
        }
      }
      switch (release2) {
        case "premajor":
          this.prerelease.length = 0;
          this.patch = 0;
          this.minor = 0;
          this.major++;
          this.inc("pre", identifier, identifierBase);
          break;
        case "preminor":
          this.prerelease.length = 0;
          this.patch = 0;
          this.minor++;
          this.inc("pre", identifier, identifierBase);
          break;
        case "prepatch":
          this.prerelease.length = 0;
          this.inc("patch", identifier, identifierBase);
          this.inc("pre", identifier, identifierBase);
          break;
        // If the input is a non-prerelease version, this acts the same as
        // prepatch.
        case "prerelease":
          if (this.prerelease.length === 0) {
            this.inc("patch", identifier, identifierBase);
          }
          this.inc("pre", identifier, identifierBase);
          break;
        case "release":
          if (this.prerelease.length === 0) {
            throw new Error(`version ${this.raw} is not a prerelease`);
          }
          this.prerelease.length = 0;
          break;
        case "major":
          if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
            this.major++;
          }
          this.minor = 0;
          this.patch = 0;
          this.prerelease = [];
          break;
        case "minor":
          if (this.patch !== 0 || this.prerelease.length === 0) {
            this.minor++;
          }
          this.patch = 0;
          this.prerelease = [];
          break;
        case "patch":
          if (this.prerelease.length === 0) {
            this.patch++;
          }
          this.prerelease = [];
          break;
        // This probably shouldn't be used publicly.
        // 1.0.0 'pre' would become 1.0.0-0 which is the wrong direction.
        case "pre": {
          const base = Number(identifierBase) ? 1 : 0;
          if (this.prerelease.length === 0) {
            this.prerelease = [base];
          } else {
            let i = this.prerelease.length;
            while (--i >= 0) {
              if (typeof this.prerelease[i] === "number") {
                this.prerelease[i]++;
                i = -2;
              }
            }
            if (i === -1) {
              if (identifier === this.prerelease.join(".") && identifierBase === false) {
                throw new Error("invalid increment argument: identifier already exists");
              }
              this.prerelease.push(base);
            }
          }
          if (identifier) {
            let prerelease = [identifier, base];
            if (identifierBase === false) {
              prerelease = [identifier];
            }
            if (isPrereleaseIdentifier(this.prerelease, identifier)) {
              const prereleaseBase = this.prerelease[identifier.split(".").length];
              if (isNaN(prereleaseBase)) {
                this.prerelease = prerelease;
              }
            } else {
              this.prerelease = prerelease;
            }
          }
          break;
        }
        default:
          throw new Error(`invalid increment argument: ${release2}`);
      }
      this.raw = this.format();
      if (this.build.length) {
        this.raw += `+${this.build.join(".")}`;
      }
      return this;
    }
  }
  semver$2 = SemVer;
  return semver$2;
}
var parse_1;
var hasRequiredParse;
function requireParse() {
  if (hasRequiredParse) return parse_1;
  hasRequiredParse = 1;
  const SemVer = requireSemver$2();
  const parse = (version, options, throwErrors = false) => {
    if (version instanceof SemVer) {
      return version;
    }
    try {
      return new SemVer(version, options);
    } catch (er) {
      if (!throwErrors) {
        return null;
      }
      throw er;
    }
  };
  parse_1 = parse;
  return parse_1;
}
var valid_1;
var hasRequiredValid$1;
function requireValid$1() {
  if (hasRequiredValid$1) return valid_1;
  hasRequiredValid$1 = 1;
  const parse = requireParse();
  const valid2 = (version, options) => {
    const v = parse(version, options);
    return v ? v.version : null;
  };
  valid_1 = valid2;
  return valid_1;
}
var clean_1;
var hasRequiredClean;
function requireClean() {
  if (hasRequiredClean) return clean_1;
  hasRequiredClean = 1;
  const parse = requireParse();
  const clean = (version, options) => {
    const s = parse(version.trim().replace(/^[=v]+/, ""), options);
    return s ? s.version : null;
  };
  clean_1 = clean;
  return clean_1;
}
var inc_1;
var hasRequiredInc;
function requireInc() {
  if (hasRequiredInc) return inc_1;
  hasRequiredInc = 1;
  const SemVer = requireSemver$2();
  const inc = (version, release2, options, identifier, identifierBase) => {
    if (typeof options === "string") {
      identifierBase = identifier;
      identifier = options;
      options = void 0;
    }
    try {
      return new SemVer(
        version instanceof SemVer ? version.version : version,
        options
      ).inc(release2, identifier, identifierBase).version;
    } catch (er) {
      return null;
    }
  };
  inc_1 = inc;
  return inc_1;
}
var diff_1;
var hasRequiredDiff;
function requireDiff() {
  if (hasRequiredDiff) return diff_1;
  hasRequiredDiff = 1;
  const parse = requireParse();
  const diff = (version1, version2) => {
    const v1 = parse(version1, null, true);
    const v2 = parse(version2, null, true);
    const comparison = v1.compare(v2);
    if (comparison === 0) {
      return null;
    }
    const v1Higher = comparison > 0;
    const highVersion = v1Higher ? v1 : v2;
    const lowVersion = v1Higher ? v2 : v1;
    const highHasPre = !!highVersion.prerelease.length;
    const lowHasPre = !!lowVersion.prerelease.length;
    if (lowHasPre && !highHasPre) {
      if (!lowVersion.patch && !lowVersion.minor) {
        return "major";
      }
      if (lowVersion.compareMain(highVersion) === 0) {
        if (lowVersion.minor && !lowVersion.patch) {
          return "minor";
        }
        return "patch";
      }
    }
    const prefix = highHasPre ? "pre" : "";
    if (v1.major !== v2.major) {
      return prefix + "major";
    }
    if (v1.minor !== v2.minor) {
      return prefix + "minor";
    }
    if (v1.patch !== v2.patch) {
      return prefix + "patch";
    }
    return "prerelease";
  };
  diff_1 = diff;
  return diff_1;
}
var major_1;
var hasRequiredMajor;
function requireMajor() {
  if (hasRequiredMajor) return major_1;
  hasRequiredMajor = 1;
  const SemVer = requireSemver$2();
  const major = (a, loose) => new SemVer(a, loose).major;
  major_1 = major;
  return major_1;
}
var minor_1;
var hasRequiredMinor;
function requireMinor() {
  if (hasRequiredMinor) return minor_1;
  hasRequiredMinor = 1;
  const SemVer = requireSemver$2();
  const minor = (a, loose) => new SemVer(a, loose).minor;
  minor_1 = minor;
  return minor_1;
}
var patch_1;
var hasRequiredPatch;
function requirePatch() {
  if (hasRequiredPatch) return patch_1;
  hasRequiredPatch = 1;
  const SemVer = requireSemver$2();
  const patch = (a, loose) => new SemVer(a, loose).patch;
  patch_1 = patch;
  return patch_1;
}
var prerelease_1;
var hasRequiredPrerelease;
function requirePrerelease() {
  if (hasRequiredPrerelease) return prerelease_1;
  hasRequiredPrerelease = 1;
  const parse = requireParse();
  const prerelease = (version, options) => {
    const parsed = parse(version, options);
    return parsed && parsed.prerelease.length ? parsed.prerelease : null;
  };
  prerelease_1 = prerelease;
  return prerelease_1;
}
var compare_1;
var hasRequiredCompare;
function requireCompare() {
  if (hasRequiredCompare) return compare_1;
  hasRequiredCompare = 1;
  const SemVer = requireSemver$2();
  const compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
  compare_1 = compare;
  return compare_1;
}
var rcompare_1;
var hasRequiredRcompare;
function requireRcompare() {
  if (hasRequiredRcompare) return rcompare_1;
  hasRequiredRcompare = 1;
  const compare = requireCompare();
  const rcompare = (a, b, loose) => compare(b, a, loose);
  rcompare_1 = rcompare;
  return rcompare_1;
}
var compareLoose_1;
var hasRequiredCompareLoose;
function requireCompareLoose() {
  if (hasRequiredCompareLoose) return compareLoose_1;
  hasRequiredCompareLoose = 1;
  const compare = requireCompare();
  const compareLoose = (a, b) => compare(a, b, true);
  compareLoose_1 = compareLoose;
  return compareLoose_1;
}
var compareBuild_1;
var hasRequiredCompareBuild;
function requireCompareBuild() {
  if (hasRequiredCompareBuild) return compareBuild_1;
  hasRequiredCompareBuild = 1;
  const SemVer = requireSemver$2();
  const compareBuild = (a, b, loose) => {
    const versionA = new SemVer(a, loose);
    const versionB = new SemVer(b, loose);
    return versionA.compare(versionB) || versionA.compareBuild(versionB);
  };
  compareBuild_1 = compareBuild;
  return compareBuild_1;
}
var sort_1;
var hasRequiredSort;
function requireSort() {
  if (hasRequiredSort) return sort_1;
  hasRequiredSort = 1;
  const compareBuild = requireCompareBuild();
  const sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
  sort_1 = sort;
  return sort_1;
}
var rsort_1;
var hasRequiredRsort;
function requireRsort() {
  if (hasRequiredRsort) return rsort_1;
  hasRequiredRsort = 1;
  const compareBuild = requireCompareBuild();
  const rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
  rsort_1 = rsort;
  return rsort_1;
}
var gt_1;
var hasRequiredGt;
function requireGt() {
  if (hasRequiredGt) return gt_1;
  hasRequiredGt = 1;
  const compare = requireCompare();
  const gt = (a, b, loose) => compare(a, b, loose) > 0;
  gt_1 = gt;
  return gt_1;
}
var lt_1;
var hasRequiredLt;
function requireLt() {
  if (hasRequiredLt) return lt_1;
  hasRequiredLt = 1;
  const compare = requireCompare();
  const lt = (a, b, loose) => compare(a, b, loose) < 0;
  lt_1 = lt;
  return lt_1;
}
var eq_1;
var hasRequiredEq;
function requireEq() {
  if (hasRequiredEq) return eq_1;
  hasRequiredEq = 1;
  const compare = requireCompare();
  const eq = (a, b, loose) => compare(a, b, loose) === 0;
  eq_1 = eq;
  return eq_1;
}
var neq_1;
var hasRequiredNeq;
function requireNeq() {
  if (hasRequiredNeq) return neq_1;
  hasRequiredNeq = 1;
  const compare = requireCompare();
  const neq = (a, b, loose) => compare(a, b, loose) !== 0;
  neq_1 = neq;
  return neq_1;
}
var gte_1;
var hasRequiredGte;
function requireGte() {
  if (hasRequiredGte) return gte_1;
  hasRequiredGte = 1;
  const compare = requireCompare();
  const gte = (a, b, loose) => compare(a, b, loose) >= 0;
  gte_1 = gte;
  return gte_1;
}
var lte_1;
var hasRequiredLte;
function requireLte() {
  if (hasRequiredLte) return lte_1;
  hasRequiredLte = 1;
  const compare = requireCompare();
  const lte = (a, b, loose) => compare(a, b, loose) <= 0;
  lte_1 = lte;
  return lte_1;
}
var cmp_1;
var hasRequiredCmp;
function requireCmp() {
  if (hasRequiredCmp) return cmp_1;
  hasRequiredCmp = 1;
  const eq = requireEq();
  const neq = requireNeq();
  const gt = requireGt();
  const gte = requireGte();
  const lt = requireLt();
  const lte = requireLte();
  const cmp = (a, op, b, loose) => {
    switch (op) {
      case "===":
        if (typeof a === "object") {
          a = a.version;
        }
        if (typeof b === "object") {
          b = b.version;
        }
        return a === b;
      case "!==":
        if (typeof a === "object") {
          a = a.version;
        }
        if (typeof b === "object") {
          b = b.version;
        }
        return a !== b;
      case "":
      case "=":
      case "==":
        return eq(a, b, loose);
      case "!=":
        return neq(a, b, loose);
      case ">":
        return gt(a, b, loose);
      case ">=":
        return gte(a, b, loose);
      case "<":
        return lt(a, b, loose);
      case "<=":
        return lte(a, b, loose);
      default:
        throw new TypeError(`Invalid operator: ${op}`);
    }
  };
  cmp_1 = cmp;
  return cmp_1;
}
var coerce_1;
var hasRequiredCoerce;
function requireCoerce() {
  if (hasRequiredCoerce) return coerce_1;
  hasRequiredCoerce = 1;
  const SemVer = requireSemver$2();
  const parse = requireParse();
  const { safeRe: re2, t } = requireRe();
  const coerce = (version, options) => {
    if (version instanceof SemVer) {
      return version;
    }
    if (typeof version === "number") {
      version = String(version);
    }
    if (typeof version !== "string") {
      return null;
    }
    options = options || {};
    let match = null;
    if (!options.rtl) {
      match = version.match(options.includePrerelease ? re2[t.COERCEFULL] : re2[t.COERCE]);
    } else {
      const coerceRtlRegex = options.includePrerelease ? re2[t.COERCERTLFULL] : re2[t.COERCERTL];
      let next;
      while ((next = coerceRtlRegex.exec(version)) && (!match || match.index + match[0].length !== version.length)) {
        if (!match || next.index + next[0].length !== match.index + match[0].length) {
          match = next;
        }
        coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
      }
      coerceRtlRegex.lastIndex = -1;
    }
    if (match === null) {
      return null;
    }
    const major = match[2];
    const minor = match[3] || "0";
    const patch = match[4] || "0";
    const prerelease = options.includePrerelease && match[5] ? `-${match[5]}` : "";
    const build = options.includePrerelease && match[6] ? `+${match[6]}` : "";
    return parse(`${major}.${minor}.${patch}${prerelease}${build}`, options);
  };
  coerce_1 = coerce;
  return coerce_1;
}
var truncate_1;
var hasRequiredTruncate;
function requireTruncate() {
  if (hasRequiredTruncate) return truncate_1;
  hasRequiredTruncate = 1;
  const parse = requireParse();
  const constants2 = requireConstants();
  const SemVer = requireSemver$2();
  const truncate = (version, truncation, options) => {
    if (!constants2.RELEASE_TYPES.includes(truncation)) {
      return null;
    }
    const clonedVersion = cloneInputVersion(version, options);
    return clonedVersion && doTruncation(clonedVersion, truncation);
  };
  const cloneInputVersion = (version, options) => {
    const versionStringToParse = version instanceof SemVer ? version.version : version;
    return parse(versionStringToParse, options);
  };
  const doTruncation = (version, truncation) => {
    if (isPrerelease(truncation)) {
      return version.version;
    }
    version.prerelease = [];
    switch (truncation) {
      case "major":
        version.minor = 0;
        version.patch = 0;
        break;
      case "minor":
        version.patch = 0;
        break;
    }
    return version.format();
  };
  const isPrerelease = (type) => {
    return type.startsWith("pre");
  };
  truncate_1 = truncate;
  return truncate_1;
}
var lrucache;
var hasRequiredLrucache;
function requireLrucache() {
  if (hasRequiredLrucache) return lrucache;
  hasRequiredLrucache = 1;
  class LRUCache {
    constructor() {
      this.max = 1e3;
      this.map = /* @__PURE__ */ new Map();
    }
    get(key) {
      const value = this.map.get(key);
      if (value === void 0) {
        return void 0;
      } else {
        this.map.delete(key);
        this.map.set(key, value);
        return value;
      }
    }
    delete(key) {
      return this.map.delete(key);
    }
    set(key, value) {
      const deleted = this.delete(key);
      if (!deleted && value !== void 0) {
        if (this.map.size >= this.max) {
          const firstKey = this.map.keys().next().value;
          this.delete(firstKey);
        }
        this.map.set(key, value);
      }
      return this;
    }
  }
  lrucache = LRUCache;
  return lrucache;
}
var range;
var hasRequiredRange;
function requireRange() {
  if (hasRequiredRange) return range;
  hasRequiredRange = 1;
  const SPACE_CHARACTERS = /\s+/g;
  class Range {
    constructor(range2, options) {
      options = parseOptions(options);
      if (range2 instanceof Range) {
        if (range2.loose === !!options.loose && range2.includePrerelease === !!options.includePrerelease) {
          return range2;
        } else {
          return new Range(range2.raw, options);
        }
      }
      if (range2 instanceof Comparator) {
        this.raw = range2.value;
        this.set = [[range2]];
        this.formatted = void 0;
        return this;
      }
      this.options = options;
      this.loose = !!options.loose;
      this.includePrerelease = !!options.includePrerelease;
      this.raw = range2.trim().replace(SPACE_CHARACTERS, " ");
      this.set = this.raw.split("||").map((r) => this.parseRange(r.trim())).filter((c) => c.length);
      if (!this.set.length) {
        throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
      }
      if (this.set.length > 1) {
        const first = this.set[0];
        this.set = this.set.filter((c) => !isNullSet(c[0]));
        if (this.set.length === 0) {
          this.set = [first];
        } else if (this.set.length > 1) {
          for (const c of this.set) {
            if (c.length === 1 && isAny(c[0])) {
              this.set = [c];
              break;
            }
          }
        }
      }
      this.formatted = void 0;
    }
    get range() {
      if (this.formatted === void 0) {
        this.formatted = "";
        for (let i = 0; i < this.set.length; i++) {
          if (i > 0) {
            this.formatted += "||";
          }
          const comps = this.set[i];
          for (let k = 0; k < comps.length; k++) {
            if (k > 0) {
              this.formatted += " ";
            }
            this.formatted += comps[k].toString().trim();
          }
        }
      }
      return this.formatted;
    }
    format() {
      return this.range;
    }
    toString() {
      return this.range;
    }
    parseRange(range2) {
      range2 = range2.replace(BUILDSTRIPRE, "");
      const memoOpts = (this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE);
      const memoKey = memoOpts + ":" + range2;
      const cached = cache.get(memoKey);
      if (cached) {
        return cached;
      }
      const loose = this.options.loose;
      const hr = loose ? re2[t.HYPHENRANGELOOSE] : re2[t.HYPHENRANGE];
      range2 = range2.replace(hr, hyphenReplace(this.options.includePrerelease));
      debug("hyphen replace", range2);
      range2 = range2.replace(re2[t.COMPARATORTRIM], comparatorTrimReplace);
      debug("comparator trim", range2);
      range2 = range2.replace(re2[t.TILDETRIM], tildeTrimReplace);
      debug("tilde trim", range2);
      range2 = range2.replace(re2[t.CARETTRIM], caretTrimReplace);
      debug("caret trim", range2);
      let rangeList = range2.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
      if (loose) {
        rangeList = rangeList.filter((comp) => {
          debug("loose invalid filter", comp, this.options);
          return !!comp.match(re2[t.COMPARATORLOOSE]);
        });
      }
      debug("range list", rangeList);
      const rangeMap = /* @__PURE__ */ new Map();
      const comparators = rangeList.map((comp) => new Comparator(comp, this.options));
      for (const comp of comparators) {
        if (isNullSet(comp)) {
          return [comp];
        }
        rangeMap.set(comp.value, comp);
      }
      if (rangeMap.size > 1 && rangeMap.has("")) {
        rangeMap.delete("");
      }
      const result = [...rangeMap.values()];
      cache.set(memoKey, result);
      return result;
    }
    intersects(range2, options) {
      if (!(range2 instanceof Range)) {
        throw new TypeError("a Range is required");
      }
      return this.set.some((thisComparators) => {
        return isSatisfiable(thisComparators, options) && range2.set.some((rangeComparators) => {
          return isSatisfiable(rangeComparators, options) && thisComparators.every((thisComparator) => {
            return rangeComparators.every((rangeComparator) => {
              return thisComparator.intersects(rangeComparator, options);
            });
          });
        });
      });
    }
    // if ANY of the sets match ALL of its comparators, then pass
    test(version) {
      if (!version) {
        return false;
      }
      if (typeof version === "string") {
        try {
          version = new SemVer(version, this.options);
        } catch (er) {
          return false;
        }
      }
      for (let i = 0; i < this.set.length; i++) {
        if (testSet(this.set[i], version, this.options)) {
          return true;
        }
      }
      return false;
    }
  }
  range = Range;
  const LRU = requireLrucache();
  const cache = new LRU();
  const parseOptions = requireParseOptions();
  const Comparator = requireComparator();
  const debug = requireDebug();
  const SemVer = requireSemver$2();
  const {
    safeRe: re2,
    src,
    t,
    comparatorTrimReplace,
    tildeTrimReplace,
    caretTrimReplace
  } = requireRe();
  const { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = requireConstants();
  const BUILDSTRIPRE = new RegExp(src[t.BUILD], "g");
  const isNullSet = (c) => c.value === "<0.0.0-0";
  const isAny = (c) => c.value === "";
  const isSatisfiable = (comparators, options) => {
    let result = true;
    const remainingComparators = comparators.slice();
    let testComparator = remainingComparators.pop();
    while (result && remainingComparators.length) {
      result = remainingComparators.every((otherComparator) => {
        return testComparator.intersects(otherComparator, options);
      });
      testComparator = remainingComparators.pop();
    }
    return result;
  };
  const parseComparator = (comp, options) => {
    comp = comp.replace(re2[t.BUILD], "");
    debug("comp", comp, options);
    comp = replaceCarets(comp, options);
    debug("caret", comp);
    comp = replaceTildes(comp, options);
    debug("tildes", comp);
    comp = replaceXRanges(comp, options);
    debug("xrange", comp);
    comp = replaceStars(comp, options);
    debug("stars", comp);
    return comp;
  };
  const isX = (id2) => !id2 || id2.toLowerCase() === "x" || id2 === "*";
  const invalidXRangeOrder = (M, m, p) => isX(M) && !isX(m) || isX(m) && p && !isX(p);
  const replaceTildes = (comp, options) => {
    return comp.trim().split(/\s+/).map((c) => replaceTilde(c, options)).join(" ");
  };
  const replaceTilde = (comp, options) => {
    const r = options.loose ? re2[t.TILDELOOSE] : re2[t.TILDE];
    const z2 = options.includePrerelease ? "-0" : "";
    return comp.replace(r, (_, M, m, p, pr) => {
      debug("tilde", comp, _, M, m, p, pr);
      let ret;
      if (isX(M)) {
        ret = "";
      } else if (isX(m)) {
        ret = `>=${M}.0.0${z2} <${+M + 1}.0.0-0`;
      } else if (isX(p)) {
        ret = `>=${M}.${m}.0${z2} <${M}.${+m + 1}.0-0`;
      } else if (pr) {
        debug("replaceTilde pr", pr);
        ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
      } else {
        ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
      }
      debug("tilde return", ret);
      return ret;
    });
  };
  const replaceCarets = (comp, options) => {
    return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
  };
  const replaceCaret = (comp, options) => {
    debug("caret", comp, options);
    const r = options.loose ? re2[t.CARETLOOSE] : re2[t.CARET];
    const z2 = options.includePrerelease ? "-0" : "";
    return comp.replace(r, (_, M, m, p, pr) => {
      debug("caret", comp, _, M, m, p, pr);
      let ret;
      if (isX(M)) {
        ret = "";
      } else if (isX(m)) {
        ret = `>=${M}.0.0${z2} <${+M + 1}.0.0-0`;
      } else if (isX(p)) {
        if (M === "0") {
          ret = `>=${M}.${m}.0${z2} <${M}.${+m + 1}.0-0`;
        } else {
          ret = `>=${M}.${m}.0${z2} <${+M + 1}.0.0-0`;
        }
      } else if (pr) {
        debug("replaceCaret pr", pr);
        if (M === "0") {
          if (m === "0") {
            ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
          } else {
            ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
          }
        } else {
          ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
        }
      } else {
        debug("no pr");
        if (M === "0") {
          if (m === "0") {
            ret = `>=${M}.${m}.${p} <${M}.${m}.${+p + 1}-0`;
          } else {
            ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
          }
        } else {
          ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
        }
      }
      debug("caret return", ret);
      return ret;
    });
  };
  const replaceXRanges = (comp, options) => {
    debug("replaceXRanges", comp, options);
    return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
  };
  const replaceXRange = (comp, options) => {
    comp = comp.trim();
    const r = options.loose ? re2[t.XRANGELOOSE] : re2[t.XRANGE];
    return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
      debug("xRange", comp, ret, gtlt, M, m, p, pr);
      if (invalidXRangeOrder(M, m, p)) {
        return comp;
      }
      const xM = isX(M);
      const xm = xM || isX(m);
      const xp = xm || isX(p);
      const anyX = xp;
      if (gtlt === "=" && anyX) {
        gtlt = "";
      }
      pr = options.includePrerelease ? "-0" : "";
      if (xM) {
        if (gtlt === ">" || gtlt === "<") {
          ret = "<0.0.0-0";
        } else {
          ret = "*";
        }
      } else if (gtlt && anyX) {
        if (xm) {
          m = 0;
        }
        p = 0;
        if (gtlt === ">") {
          gtlt = ">=";
          if (xm) {
            M = +M + 1;
            m = 0;
            p = 0;
          } else {
            m = +m + 1;
            p = 0;
          }
        } else if (gtlt === "<=") {
          gtlt = "<";
          if (xm) {
            M = +M + 1;
          } else {
            m = +m + 1;
          }
        }
        if (gtlt === "<") {
          pr = "-0";
        }
        ret = `${gtlt + M}.${m}.${p}${pr}`;
      } else if (xm) {
        ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
      } else if (xp) {
        ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
      }
      debug("xRange return", ret);
      return ret;
    });
  };
  const replaceStars = (comp, options) => {
    debug("replaceStars", comp, options);
    return comp.trim().replace(re2[t.STAR], "");
  };
  const replaceGTE0 = (comp, options) => {
    debug("replaceGTE0", comp, options);
    return comp.trim().replace(re2[options.includePrerelease ? t.GTE0PRE : t.GTE0], "");
  };
  const hyphenReplace = (incPr) => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
    if (isX(fM)) {
      from = "";
    } else if (isX(fm)) {
      from = `>=${fM}.0.0${incPr ? "-0" : ""}`;
    } else if (isX(fp)) {
      from = `>=${fM}.${fm}.0${incPr ? "-0" : ""}`;
    } else if (fpr) {
      from = `>=${from}`;
    } else {
      from = `>=${from}${incPr ? "-0" : ""}`;
    }
    if (isX(tM)) {
      to = "";
    } else if (isX(tm)) {
      to = `<${+tM + 1}.0.0-0`;
    } else if (isX(tp)) {
      to = `<${tM}.${+tm + 1}.0-0`;
    } else if (tpr) {
      to = `<=${tM}.${tm}.${tp}-${tpr}`;
    } else if (incPr) {
      to = `<${tM}.${tm}.${+tp + 1}-0`;
    } else {
      to = `<=${to}`;
    }
    return `${from} ${to}`.trim();
  };
  const testSet = (set, version, options) => {
    for (let i = 0; i < set.length; i++) {
      if (!set[i].test(version)) {
        return false;
      }
    }
    if (version.prerelease.length && !options.includePrerelease) {
      for (let i = 0; i < set.length; i++) {
        debug(set[i].semver);
        if (set[i].semver === Comparator.ANY) {
          continue;
        }
        if (set[i].semver.prerelease.length > 0) {
          const allowed = set[i].semver;
          if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) {
            return true;
          }
        }
      }
      return false;
    }
    return true;
  };
  return range;
}
var comparator;
var hasRequiredComparator;
function requireComparator() {
  if (hasRequiredComparator) return comparator;
  hasRequiredComparator = 1;
  const ANY = Symbol("SemVer ANY");
  class Comparator {
    static get ANY() {
      return ANY;
    }
    constructor(comp, options) {
      options = parseOptions(options);
      if (comp instanceof Comparator) {
        if (comp.loose === !!options.loose) {
          return comp;
        } else {
          comp = comp.value;
        }
      }
      comp = comp.trim().split(/\s+/).join(" ");
      debug("comparator", comp, options);
      this.options = options;
      this.loose = !!options.loose;
      this.parse(comp);
      if (this.semver === ANY) {
        this.value = "";
      } else {
        this.value = this.operator + this.semver.version;
      }
      debug("comp", this);
    }
    parse(comp) {
      const r = this.options.loose ? re2[t.COMPARATORLOOSE] : re2[t.COMPARATOR];
      const m = comp.match(r);
      if (!m) {
        throw new TypeError(`Invalid comparator: ${comp}`);
      }
      this.operator = m[1] !== void 0 ? m[1] : "";
      if (this.operator === "=") {
        this.operator = "";
      }
      if (!m[2]) {
        this.semver = ANY;
      } else {
        this.semver = new SemVer(m[2], this.options.loose);
      }
    }
    toString() {
      return this.value;
    }
    test(version) {
      debug("Comparator.test", version, this.options.loose);
      if (this.semver === ANY || version === ANY) {
        return true;
      }
      if (typeof version === "string") {
        try {
          version = new SemVer(version, this.options);
        } catch (er) {
          return false;
        }
      }
      return cmp(version, this.operator, this.semver, this.options);
    }
    intersects(comp, options) {
      if (!(comp instanceof Comparator)) {
        throw new TypeError("a Comparator is required");
      }
      if (this.operator === "") {
        if (this.value === "") {
          return true;
        }
        return new Range(comp.value, options).test(this.value);
      } else if (comp.operator === "") {
        if (comp.value === "") {
          return true;
        }
        return new Range(this.value, options).test(comp.semver);
      }
      options = parseOptions(options);
      if (options.includePrerelease && (this.value === "<0.0.0-0" || comp.value === "<0.0.0-0")) {
        return false;
      }
      if (!options.includePrerelease && (this.value.startsWith("<0.0.0") || comp.value.startsWith("<0.0.0"))) {
        return false;
      }
      if (this.operator.startsWith(">") && comp.operator.startsWith(">")) {
        return true;
      }
      if (this.operator.startsWith("<") && comp.operator.startsWith("<")) {
        return true;
      }
      if (this.semver.version === comp.semver.version && this.operator.includes("=") && comp.operator.includes("=")) {
        return true;
      }
      if (cmp(this.semver, "<", comp.semver, options) && this.operator.startsWith(">") && comp.operator.startsWith("<")) {
        return true;
      }
      if (cmp(this.semver, ">", comp.semver, options) && this.operator.startsWith("<") && comp.operator.startsWith(">")) {
        return true;
      }
      return false;
    }
  }
  comparator = Comparator;
  const parseOptions = requireParseOptions();
  const { safeRe: re2, t } = requireRe();
  const cmp = requireCmp();
  const debug = requireDebug();
  const SemVer = requireSemver$2();
  const Range = requireRange();
  return comparator;
}
var satisfies_1;
var hasRequiredSatisfies;
function requireSatisfies() {
  if (hasRequiredSatisfies) return satisfies_1;
  hasRequiredSatisfies = 1;
  const Range = requireRange();
  const satisfies = (version, range2, options) => {
    try {
      range2 = new Range(range2, options);
    } catch (er) {
      return false;
    }
    return range2.test(version);
  };
  satisfies_1 = satisfies;
  return satisfies_1;
}
var toComparators_1;
var hasRequiredToComparators;
function requireToComparators() {
  if (hasRequiredToComparators) return toComparators_1;
  hasRequiredToComparators = 1;
  const Range = requireRange();
  const toComparators = (range2, options) => new Range(range2, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
  toComparators_1 = toComparators;
  return toComparators_1;
}
var maxSatisfying_1;
var hasRequiredMaxSatisfying;
function requireMaxSatisfying() {
  if (hasRequiredMaxSatisfying) return maxSatisfying_1;
  hasRequiredMaxSatisfying = 1;
  const SemVer = requireSemver$2();
  const Range = requireRange();
  const maxSatisfying = (versions, range2, options) => {
    let max = null;
    let maxSV = null;
    let rangeObj = null;
    try {
      rangeObj = new Range(range2, options);
    } catch (er) {
      return null;
    }
    versions.forEach((v) => {
      if (rangeObj.test(v)) {
        if (!max || maxSV.compare(v) === -1) {
          max = v;
          maxSV = new SemVer(max, options);
        }
      }
    });
    return max;
  };
  maxSatisfying_1 = maxSatisfying;
  return maxSatisfying_1;
}
var minSatisfying_1;
var hasRequiredMinSatisfying;
function requireMinSatisfying() {
  if (hasRequiredMinSatisfying) return minSatisfying_1;
  hasRequiredMinSatisfying = 1;
  const SemVer = requireSemver$2();
  const Range = requireRange();
  const minSatisfying = (versions, range2, options) => {
    let min = null;
    let minSV = null;
    let rangeObj = null;
    try {
      rangeObj = new Range(range2, options);
    } catch (er) {
      return null;
    }
    versions.forEach((v) => {
      if (rangeObj.test(v)) {
        if (!min || minSV.compare(v) === 1) {
          min = v;
          minSV = new SemVer(min, options);
        }
      }
    });
    return min;
  };
  minSatisfying_1 = minSatisfying;
  return minSatisfying_1;
}
var minVersion_1;
var hasRequiredMinVersion;
function requireMinVersion() {
  if (hasRequiredMinVersion) return minVersion_1;
  hasRequiredMinVersion = 1;
  const SemVer = requireSemver$2();
  const Range = requireRange();
  const gt = requireGt();
  const minVersion = (range2, loose) => {
    range2 = new Range(range2, loose);
    let minver = new SemVer("0.0.0");
    if (range2.test(minver)) {
      return minver;
    }
    minver = new SemVer("0.0.0-0");
    if (range2.test(minver)) {
      return minver;
    }
    minver = null;
    for (let i = 0; i < range2.set.length; ++i) {
      const comparators = range2.set[i];
      let setMin = null;
      comparators.forEach((comparator2) => {
        const compver = new SemVer(comparator2.semver.version);
        switch (comparator2.operator) {
          case ">":
            if (compver.prerelease.length === 0) {
              compver.patch++;
            } else {
              compver.prerelease.push(0);
            }
            compver.raw = compver.format();
          /* fallthrough */
          case "":
          case ">=":
            if (!setMin || gt(compver, setMin)) {
              setMin = compver;
            }
            break;
          case "<":
          case "<=":
            break;
          /* istanbul ignore next */
          default:
            throw new Error(`Unexpected operation: ${comparator2.operator}`);
        }
      });
      if (setMin && (!minver || gt(minver, setMin))) {
        minver = setMin;
      }
    }
    if (minver && range2.test(minver)) {
      return minver;
    }
    return null;
  };
  minVersion_1 = minVersion;
  return minVersion_1;
}
var valid;
var hasRequiredValid;
function requireValid() {
  if (hasRequiredValid) return valid;
  hasRequiredValid = 1;
  const Range = requireRange();
  const validRange = (range2, options) => {
    try {
      return new Range(range2, options).range || "*";
    } catch (er) {
      return null;
    }
  };
  valid = validRange;
  return valid;
}
var outside_1;
var hasRequiredOutside;
function requireOutside() {
  if (hasRequiredOutside) return outside_1;
  hasRequiredOutside = 1;
  const SemVer = requireSemver$2();
  const Comparator = requireComparator();
  const { ANY } = Comparator;
  const Range = requireRange();
  const satisfies = requireSatisfies();
  const gt = requireGt();
  const lt = requireLt();
  const lte = requireLte();
  const gte = requireGte();
  const outside = (version, range2, hilo, options) => {
    version = new SemVer(version, options);
    range2 = new Range(range2, options);
    let gtfn, ltefn, ltfn, comp, ecomp;
    switch (hilo) {
      case ">":
        gtfn = gt;
        ltefn = lte;
        ltfn = lt;
        comp = ">";
        ecomp = ">=";
        break;
      case "<":
        gtfn = lt;
        ltefn = gte;
        ltfn = gt;
        comp = "<";
        ecomp = "<=";
        break;
      default:
        throw new TypeError('Must provide a hilo val of "<" or ">"');
    }
    if (satisfies(version, range2, options)) {
      return false;
    }
    for (let i = 0; i < range2.set.length; ++i) {
      const comparators = range2.set[i];
      let high = null;
      let low = null;
      comparators.forEach((comparator2) => {
        if (comparator2.semver === ANY) {
          comparator2 = new Comparator(">=0.0.0");
        }
        high = high || comparator2;
        low = low || comparator2;
        if (gtfn(comparator2.semver, high.semver, options)) {
          high = comparator2;
        } else if (ltfn(comparator2.semver, low.semver, options)) {
          low = comparator2;
        }
      });
      if (high.operator === comp || high.operator === ecomp) {
        return false;
      }
      if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) {
        return false;
      } else if (low.operator === ecomp && ltfn(version, low.semver)) {
        return false;
      }
    }
    return true;
  };
  outside_1 = outside;
  return outside_1;
}
var gtr_1;
var hasRequiredGtr;
function requireGtr() {
  if (hasRequiredGtr) return gtr_1;
  hasRequiredGtr = 1;
  const outside = requireOutside();
  const gtr = (version, range2, options) => outside(version, range2, ">", options);
  gtr_1 = gtr;
  return gtr_1;
}
var ltr_1;
var hasRequiredLtr;
function requireLtr() {
  if (hasRequiredLtr) return ltr_1;
  hasRequiredLtr = 1;
  const outside = requireOutside();
  const ltr = (version, range2, options) => outside(version, range2, "<", options);
  ltr_1 = ltr;
  return ltr_1;
}
var intersects_1;
var hasRequiredIntersects;
function requireIntersects() {
  if (hasRequiredIntersects) return intersects_1;
  hasRequiredIntersects = 1;
  const Range = requireRange();
  const intersects = (r1, r2, options) => {
    r1 = new Range(r1, options);
    r2 = new Range(r2, options);
    return r1.intersects(r2, options);
  };
  intersects_1 = intersects;
  return intersects_1;
}
var simplify;
var hasRequiredSimplify;
function requireSimplify() {
  if (hasRequiredSimplify) return simplify;
  hasRequiredSimplify = 1;
  const satisfies = requireSatisfies();
  const compare = requireCompare();
  simplify = (versions, range2, options) => {
    const set = [];
    let first = null;
    let prev = null;
    const v = versions.sort((a, b) => compare(a, b, options));
    for (const version of v) {
      const included = satisfies(version, range2, options);
      if (included) {
        prev = version;
        if (!first) {
          first = version;
        }
      } else {
        if (prev) {
          set.push([first, prev]);
        }
        prev = null;
        first = null;
      }
    }
    if (first) {
      set.push([first, null]);
    }
    const ranges = [];
    for (const [min, max] of set) {
      if (min === max) {
        ranges.push(min);
      } else if (!max && min === v[0]) {
        ranges.push("*");
      } else if (!max) {
        ranges.push(`>=${min}`);
      } else if (min === v[0]) {
        ranges.push(`<=${max}`);
      } else {
        ranges.push(`${min} - ${max}`);
      }
    }
    const simplified = ranges.join(" || ");
    const original = typeof range2.raw === "string" ? range2.raw : String(range2);
    return simplified.length < original.length ? simplified : range2;
  };
  return simplify;
}
var subset_1;
var hasRequiredSubset;
function requireSubset() {
  if (hasRequiredSubset) return subset_1;
  hasRequiredSubset = 1;
  const Range = requireRange();
  const Comparator = requireComparator();
  const { ANY } = Comparator;
  const satisfies = requireSatisfies();
  const compare = requireCompare();
  const subset = (sub, dom, options = {}) => {
    if (sub === dom) {
      return true;
    }
    sub = new Range(sub, options);
    dom = new Range(dom, options);
    let sawNonNull = false;
    OUTER: for (const simpleSub of sub.set) {
      for (const simpleDom of dom.set) {
        const isSub = simpleSubset(simpleSub, simpleDom, options);
        sawNonNull = sawNonNull || isSub !== null;
        if (isSub) {
          continue OUTER;
        }
      }
      if (sawNonNull) {
        return false;
      }
    }
    return true;
  };
  const minimumVersionWithPreRelease = [new Comparator(">=0.0.0-0")];
  const minimumVersion = [new Comparator(">=0.0.0")];
  const simpleSubset = (sub, dom, options) => {
    if (sub === dom) {
      return true;
    }
    if (sub.length === 1 && sub[0].semver === ANY) {
      if (dom.length === 1 && dom[0].semver === ANY) {
        return true;
      } else if (options.includePrerelease) {
        sub = minimumVersionWithPreRelease;
      } else {
        sub = minimumVersion;
      }
    }
    if (dom.length === 1 && dom[0].semver === ANY) {
      if (options.includePrerelease) {
        return true;
      } else {
        dom = minimumVersion;
      }
    }
    const eqSet = /* @__PURE__ */ new Set();
    let gt, lt;
    for (const c of sub) {
      if (c.operator === ">" || c.operator === ">=") {
        gt = higherGT(gt, c, options);
      } else if (c.operator === "<" || c.operator === "<=") {
        lt = lowerLT(lt, c, options);
      } else {
        eqSet.add(c.semver);
      }
    }
    if (eqSet.size > 1) {
      return null;
    }
    let gtltComp;
    if (gt && lt) {
      gtltComp = compare(gt.semver, lt.semver, options);
      if (gtltComp > 0) {
        return null;
      } else if (gtltComp === 0 && (gt.operator !== ">=" || lt.operator !== "<=")) {
        return null;
      }
    }
    for (const eq of eqSet) {
      if (gt && !satisfies(eq, String(gt), options)) {
        return null;
      }
      if (lt && !satisfies(eq, String(lt), options)) {
        return null;
      }
      for (const c of dom) {
        if (!satisfies(eq, String(c), options)) {
          return false;
        }
      }
      return true;
    }
    let higher, lower;
    let hasDomLT, hasDomGT;
    let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
    let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
    if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === "<" && needDomLTPre.prerelease[0] === 0) {
      needDomLTPre = false;
    }
    for (const c of dom) {
      hasDomGT = hasDomGT || c.operator === ">" || c.operator === ">=";
      hasDomLT = hasDomLT || c.operator === "<" || c.operator === "<=";
      if (gt) {
        if (needDomGTPre) {
          if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) {
            needDomGTPre = false;
          }
        }
        if (c.operator === ">" || c.operator === ">=") {
          higher = higherGT(gt, c, options);
          if (higher === c && higher !== gt) {
            return false;
          }
        } else if (gt.operator === ">=" && !c.test(gt.semver)) {
          return false;
        }
      }
      if (lt) {
        if (needDomLTPre) {
          if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) {
            needDomLTPre = false;
          }
        }
        if (c.operator === "<" || c.operator === "<=") {
          lower = lowerLT(lt, c, options);
          if (lower === c && lower !== lt) {
            return false;
          }
        } else if (lt.operator === "<=" && !c.test(lt.semver)) {
          return false;
        }
      }
      if (!c.operator && (lt || gt) && gtltComp !== 0) {
        return false;
      }
    }
    if (gt && hasDomLT && !lt && gtltComp !== 0) {
      return false;
    }
    if (lt && hasDomGT && !gt && gtltComp !== 0) {
      return false;
    }
    if (needDomGTPre || needDomLTPre) {
      return false;
    }
    return true;
  };
  const higherGT = (a, b, options) => {
    if (!a) {
      return b;
    }
    const comp = compare(a.semver, b.semver, options);
    return comp > 0 ? a : comp < 0 ? b : b.operator === ">" && a.operator === ">=" ? b : a;
  };
  const lowerLT = (a, b, options) => {
    if (!a) {
      return b;
    }
    const comp = compare(a.semver, b.semver, options);
    return comp < 0 ? a : comp > 0 ? b : b.operator === "<" && a.operator === "<=" ? b : a;
  };
  subset_1 = subset;
  return subset_1;
}
var semver$1;
var hasRequiredSemver$1;
function requireSemver$1() {
  if (hasRequiredSemver$1) return semver$1;
  hasRequiredSemver$1 = 1;
  const internalRe = requireRe();
  const constants2 = requireConstants();
  const SemVer = requireSemver$2();
  const identifiers2 = requireIdentifiers();
  const parse = requireParse();
  const valid2 = requireValid$1();
  const clean = requireClean();
  const inc = requireInc();
  const diff = requireDiff();
  const major = requireMajor();
  const minor = requireMinor();
  const patch = requirePatch();
  const prerelease = requirePrerelease();
  const compare = requireCompare();
  const rcompare = requireRcompare();
  const compareLoose = requireCompareLoose();
  const compareBuild = requireCompareBuild();
  const sort = requireSort();
  const rsort = requireRsort();
  const gt = requireGt();
  const lt = requireLt();
  const eq = requireEq();
  const neq = requireNeq();
  const gte = requireGte();
  const lte = requireLte();
  const cmp = requireCmp();
  const coerce = requireCoerce();
  const truncate = requireTruncate();
  const Comparator = requireComparator();
  const Range = requireRange();
  const satisfies = requireSatisfies();
  const toComparators = requireToComparators();
  const maxSatisfying = requireMaxSatisfying();
  const minSatisfying = requireMinSatisfying();
  const minVersion = requireMinVersion();
  const validRange = requireValid();
  const outside = requireOutside();
  const gtr = requireGtr();
  const ltr = requireLtr();
  const intersects = requireIntersects();
  const simplifyRange = requireSimplify();
  const subset = requireSubset();
  semver$1 = {
    parse,
    valid: valid2,
    clean,
    inc,
    diff,
    major,
    minor,
    patch,
    prerelease,
    compare,
    rcompare,
    compareLoose,
    compareBuild,
    sort,
    rsort,
    gt,
    lt,
    eq,
    neq,
    gte,
    lte,
    cmp,
    coerce,
    truncate,
    Comparator,
    Range,
    satisfies,
    toComparators,
    maxSatisfying,
    minSatisfying,
    minVersion,
    validRange,
    outside,
    gtr,
    ltr,
    intersects,
    simplifyRange,
    subset,
    SemVer,
    re: internalRe.re,
    src: internalRe.src,
    tokens: internalRe.t,
    SEMVER_SPEC_VERSION: constants2.SEMVER_SPEC_VERSION,
    RELEASE_TYPES: constants2.RELEASE_TYPES,
    compareIdentifiers: identifiers2.compareIdentifiers,
    rcompareIdentifiers: identifiers2.rcompareIdentifiers
  };
  return semver$1;
}
var semverExports$1 = requireSemver$1();
const supportedBetaIdentifiers = /* @__PURE__ */ new Set(["beta", "rc"]);
const githubAssetSchema = z.object({
  name: z.string().min(1).max(200),
  browser_download_url: z.string().url().max(2048)
});
const githubReleaseSchema = z.object({
  draft: z.boolean(),
  prerelease: z.boolean(),
  tag_name: z.string().min(1).max(100),
  published_at: z.string().datetime().nullable(),
  assets: z.array(githubAssetSchema).max(50)
});
const githubReleasesSchema = z.array(githubReleaseSchema).max(100);
function isCompatibleVersion(version, releaseIsPrerelease, channel) {
  const identifiers2 = semverExports$1.prerelease(version);
  if (identifiers2 === null) return !releaseIsPrerelease;
  if (channel === "stable" || !releaseIsPrerelease) return false;
  return typeof identifiers2[0] === "string" && supportedBetaIdentifiers.has(identifiers2[0]);
}
function safeMetadataAssetUrl(rawUrl, owner, repo, tagName, assetName) {
  try {
    const url = new URL(rawUrl);
    const expectedPath = `/${owner}/${repo}/releases/download/${tagName}/${assetName}`;
    if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password || url.search || url.hash || url.pathname !== expectedPath) return null;
    return url;
  } catch {
    return null;
  }
}
function metadataAssetName(channel, platform2) {
  if (platform2 === "darwin") return `${channel}-mac.yml`;
  if (platform2 === "linux") return `${channel}-linux.yml`;
  return `${channel}.yml`;
}
function selectCompatibleRelease(releases, currentVersion, channel, repository, platform2 = "darwin") {
  if (!semverExports$1.valid(currentVersion)) return null;
  const candidates = [];
  for (const release2 of releases) {
    if (release2.draft || release2.published_at === null) continue;
    const version = semverExports$1.valid(release2.tag_name);
    if (!version || !semverExports$1.gt(version, currentVersion) || !isCompatibleVersion(version, release2.prerelease, channel)) continue;
    const isPrerelease = semverExports$1.prerelease(version) !== null;
    const feedChannel = isPrerelease ? "beta" : "latest";
    const assetName = metadataAssetName(feedChannel, platform2);
    const asset = release2.assets.find((entry) => entry.name === assetName);
    const assetUrl = asset ? safeMetadataAssetUrl(asset.browser_download_url, repository.owner, repository.repo, release2.tag_name, assetName) : null;
    if (!assetUrl) continue;
    candidates.push({
      version,
      tagName: release2.tag_name,
      prerelease: isPrerelease,
      feedBaseUrl: new URL(".", assetUrl).href,
      feedChannel,
      metadataAssetUrl: assetUrl.href
    });
  }
  return candidates.sort((left, right) => semverExports$1.compare(right.version, left.version))[0] ?? null;
}
class GitHubReleaseDiscovery {
  owner;
  repo;
  timeoutMs;
  maxResponseBytes;
  request;
  platform;
  constructor(options) {
    if (!/^[A-Za-z0-9_.-]+$/.test(options.owner) || !/^[A-Za-z0-9_.-]+$/.test(options.repo)) throw new Error("Invalid GitHub repository coordinates.");
    this.owner = options.owner;
    this.repo = options.repo;
    this.platform = options.platform ?? (process.platform === "win32" ? "win32" : process.platform === "linux" ? "linux" : "darwin");
    this.timeoutMs = options.timeoutMs ?? 1e4;
    this.maxResponseBytes = options.maxResponseBytes ?? 1e6;
    this.request = options.fetch ?? ((url, init) => fetch$1(url, init));
  }
  async discover(currentVersion, channel, signal) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("GitHub release discovery timed out.")), this.timeoutMs);
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const url = `https://api.github.com/repos/${this.owner}/${this.repo}/releases?per_page=50`;
      const response = await this.request(url, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "FORGE-Updater",
          "X-GitHub-Api-Version": "2022-11-28"
        },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`GitHub release discovery failed with HTTP ${response.status}.`);
      const contentType = response.headers.get("content-type");
      if (contentType && !contentType.toLowerCase().includes("application/json")) throw new Error("GitHub release discovery returned an unsupported content type.");
      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > this.maxResponseBytes) throw new Error("GitHub release discovery response exceeded its size limit.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > this.maxResponseBytes) throw new Error("GitHub release discovery response exceeded its size limit.");
      let payload;
      try {
        payload = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        throw new Error("GitHub release discovery returned malformed JSON.");
      }
      const releases = githubReleasesSchema.parse(payload);
      return selectCompatibleRelease(releases, currentVersion, channel, { owner: this.owner, repo: this.repo }, this.platform);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
}
const { autoUpdater } = electronUpdater;
const releasesUrl = "https://github.com/kaeganscott26/FORGE/releases";
const releaseDiscovery = new GitHubReleaseDiscovery({ owner: "kaeganscott26", repo: "FORGE", platform: process.platform === "win32" ? "win32" : process.platform === "linux" ? "linux" : "darwin" });
class UpdaterService {
  constructor(discovery = releaseDiscovery) {
    this.discovery = discovery;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.on("checking-for-update", () => this.setStatus("checking", "Checking GitHub Releases for an update…"));
    autoUpdater.on("update-not-available", () => this.setStatus("not-available", "FORGE is up to date."));
    autoUpdater.on("download-progress", (progress) => this.setStatus("downloading", `Downloading update: ${Math.round(progress.percent)}%.`, this.updateStatus.availableVersion));
    autoUpdater.on("update-downloaded", (info) => this.setStatus("downloaded", `FORGE ${info.version} is ready. Restart to apply it.`, info.version));
    autoUpdater.on("error", (error) => this.setStatus("error", `Automatic update failed: ${error.message} Download the latest release manually.`));
  }
  channel = "stable";
  updateStatus = {
    currentVersion: app.getVersion(),
    state: "idle",
    message: "Ready to check for updates."
  };
  setChannel(channel) {
    this.channel = channel;
    const policy = buildUpdatePolicy(channel);
    autoUpdater.allowPrerelease = policy.allowPrerelease;
    autoUpdater.allowDowngrade = policy.allowDowngrade;
  }
  status() {
    return { ...this.updateStatus, currentVersion: app.getVersion() };
  }
  async check() {
    if (!app.isPackaged) {
      const localUpdateCommand = process.platform === "win32" ? "npm run update:win" : process.platform === "darwin" ? "npm run update:mac" : "./scripts/package-linux.sh";
      this.setStatus("development", `Update checks run only in the packaged app. Use ${localUpdateCommand} for this platform.`);
      return this.status();
    }
    try {
      this.setStatus("checking", "Checking GitHub Releases for an update…");
      const policy = buildUpdatePolicy(this.channel);
      const selected = await this.discovery.discover(app.getVersion(), this.channel);
      if (!selected) {
        this.setStatus("not-available", "FORGE is up to date. Older versions and releases outside the selected channel are never installed.");
        return this.status();
      }
      autoUpdater.setFeedURL({ provider: "generic", url: selected.feedBaseUrl, channel: selected.feedChannel });
      autoUpdater.allowPrerelease = policy.allowPrerelease;
      autoUpdater.channel = selected.feedChannel;
      autoUpdater.allowDowngrade = false;
      const result = await autoUpdater.checkForUpdates();
      const candidateVersion = result?.updateInfo.version;
      if (!candidateVersion || candidateVersion !== selected.version || !isUpdateVersionEligible(app.getVersion(), candidateVersion, this.channel)) {
        this.setStatus("not-available", "FORGE is up to date. Older versions and releases outside the selected channel are never installed.");
        return this.status();
      }
      this.setStatus("available", `FORGE ${candidateVersion} is newer and will download now.`, candidateVersion);
      await autoUpdater.downloadUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown update error.";
      this.setStatus("error", `Automatic update failed: ${message} Download the latest release manually.`);
    }
    return this.status();
  }
  install() {
    if (this.updateStatus.state !== "downloaded") throw new Error("No downloaded update is ready to install.");
    autoUpdater.quitAndInstall(false, true);
  }
  async openLatestRelease() {
    await shell.openExternal(releasesUrl);
  }
  setStatus(state, message, availableVersion) {
    this.updateStatus = { currentVersion: app.getVersion(), state, message, availableVersion };
  }
}
const defaultBaseUrl = "https://api.openai.com/v1";
class SettingsService {
  data = {};
  settingsPath = "";
  askPassPath = "";
  encryptionAvailable = false;
  async init() {
    const userDataPath = app.getPath("userData");
    this.settingsPath = join(userDataPath, "settings.json");
    this.askPassPath = join(userDataPath, "forge-git-askpass.sh");
    await promises.mkdir(userDataPath, { recursive: true });
    this.data = await promises.readFile(this.settingsPath, "utf8").then((text) => JSON.parse(text)).catch(() => ({}));
    this.encryptionAvailable = await safeStorage.isAsyncEncryptionAvailable();
    await promises.writeFile(this.askPassPath, '#!/bin/sh\ncase "$1" in\n  *Username*) printf "%s" "$FORGE_GITHUB_USERNAME" ;;\n  *Password*) printf "%s" "$FORGE_GITHUB_TOKEN" ;;\n  *) printf "%s" "" ;;\nesac\n', { mode: 448 });
    await promises.chmod(this.askPassPath, 448);
  }
  publicSettings() {
    return {
      apiBaseUrl: this.data.apiBaseUrl ?? process.env.OPENAI_BASE_URL ?? defaultBaseUrl,
      apiModel: this.data.apiModel ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
      apiKeyConfigured: Boolean(this.data.apiKey || process.env.OPENAI_API_KEY),
      githubUsername: this.data.githubUsername ?? "",
      githubTokenConfigured: Boolean(this.data.githubToken),
      secureStorageAvailable: this.encryptionAvailable,
      webResearchEnabled: this.data.webResearchEnabled === true,
      updateChannel: normalizeUpdateChannel(this.data.updateChannel),
      agentRuntime: this.data.agentRuntime === "hermes" ? "hermes" : "native",
      hermesCommand: this.data.hermesCommand ?? "",
      hermesEndpoint: this.data.hermesEndpoint ?? "",
      embeddingEnabled: this.data.embeddingEnabled !== false,
      embeddingProvider: "openai-compatible",
      embeddingBaseUrl: this.data.embeddingBaseUrl ?? process.env.FORGE_EMBEDDING_BASE_URL ?? DEFAULT_EMBEDDING_BASE_URL,
      embeddingModel: this.data.embeddingModel ?? process.env.FORGE_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL,
      embeddingApiKeyConfigured: Boolean(this.data.embeddingApiKey || process.env.FORGE_EMBEDDING_API_KEY),
      contextTokenBudget: Math.min(128e3, Math.max(4e3, this.data.contextTokenBudget ?? DEFAULT_CONTEXT_TOKEN_BUDGET)),
      agentExecutionMode: this.data.agentExecutionMode === "disabled" || this.data.agentExecutionMode === "allow-all" ? this.data.agentExecutionMode : "controlled",
      filesystemScope: ["repository", "project-tree", "home", "full"].includes(this.data.filesystemScope ?? "") ? this.data.filesystemScope : "workspace",
      projectTreeRoot: this.data.projectTreeRoot ?? "",
      networkAccess: { web: this.data.networkAccess?.web === true, git: this.data.networkAccess?.git === true, packageManager: this.data.networkAccess?.packageManager === true, general: this.data.networkAccess?.general === true },
      processMode: this.data.processMode === "full-local-compute" ? "full-local-compute" : "standard",
      processTimeoutMs: Math.min(6e5, Math.max(1e3, this.data.processTimeoutMs ?? 12e4)),
      backgroundTaskTimeoutMs: Math.min(864e5, Math.max(1e3, this.data.backgroundTaskTimeoutMs ?? 6e5)),
      autonomousTaskContinuation: this.data.autonomousTaskContinuation !== false,
      autoRepairToolArguments: this.data.autoRepairToolArguments !== false,
      backgroundTasksEnabled: this.data.backgroundTasksEnabled !== false,
      autoIndex: this.data.autoIndex !== false,
      autoRepairIndex: this.data.autoRepairIndex !== false
    };
  }
  async save(request) {
    this.data.apiBaseUrl = this.validateUrl(request.apiBaseUrl || defaultBaseUrl);
    this.data.apiModel = request.apiModel.trim() || DEFAULT_OPENAI_MODEL;
    this.data.githubUsername = request.githubUsername.trim();
    this.data.webResearchEnabled = request.webResearchEnabled === true;
    this.data.updateChannel = normalizeUpdateChannel(request.updateChannel);
    this.data.agentRuntime = request.agentRuntime === "hermes" ? "hermes" : "native";
    const hermesCommand = request.hermesCommand?.trim();
    if (hermesCommand) this.data.hermesCommand = this.validateCommand(hermesCommand);
    else delete this.data.hermesCommand;
    const hermesEndpoint = request.hermesEndpoint?.trim();
    if (hermesEndpoint) this.data.hermesEndpoint = this.validateUrl(hermesEndpoint);
    else delete this.data.hermesEndpoint;
    this.data.embeddingEnabled = request.embeddingEnabled ?? this.data.embeddingEnabled ?? true;
    this.data.embeddingProvider = "openai-compatible";
    this.data.embeddingBaseUrl = this.validateUrl(request.embeddingBaseUrl || DEFAULT_EMBEDDING_BASE_URL);
    this.data.embeddingModel = request.embeddingModel?.trim() || DEFAULT_EMBEDDING_MODEL;
    this.data.contextTokenBudget = Math.min(128e3, Math.max(4e3, Math.round(request.contextTokenBudget ?? DEFAULT_CONTEXT_TOKEN_BUDGET)));
    this.data.agentExecutionMode = request.agentExecutionMode === "disabled" || request.agentExecutionMode === "allow-all" ? request.agentExecutionMode : "controlled";
    this.data.filesystemScope = ["repository", "project-tree", "home", "full"].includes(request.filesystemScope ?? "") ? request.filesystemScope : "workspace";
    this.data.projectTreeRoot = request.projectTreeRoot?.trim().slice(0, 4096) ?? "";
    this.data.networkAccess = { web: request.networkAccess?.web === true, git: request.networkAccess?.git === true, packageManager: request.networkAccess?.packageManager === true, general: request.networkAccess?.general === true };
    this.data.processMode = request.processMode === "full-local-compute" ? request.processMode : "standard";
    this.data.processTimeoutMs = Math.min(6e5, Math.max(1e3, Math.round(request.processTimeoutMs ?? 12e4)));
    this.data.backgroundTaskTimeoutMs = Math.min(864e5, Math.max(1e3, Math.round(request.backgroundTaskTimeoutMs ?? 6e5)));
    this.data.autonomousTaskContinuation = request.autonomousTaskContinuation !== false;
    this.data.autoRepairToolArguments = request.autoRepairToolArguments !== false;
    this.data.backgroundTasksEnabled = request.backgroundTasksEnabled !== false;
    this.data.autoIndex = request.autoIndex !== false;
    this.data.autoRepairIndex = request.autoRepairIndex !== false;
    if (request.clearApiKey) delete this.data.apiKey;
    else if (request.apiKey?.trim()) this.data.apiKey = await this.encrypt(request.apiKey.trim());
    if (request.clearGithubToken) delete this.data.githubToken;
    else if (request.githubToken?.trim()) this.data.githubToken = await this.encrypt(request.githubToken.trim());
    if (request.clearEmbeddingApiKey) delete this.data.embeddingApiKey;
    else if (request.embeddingApiKey?.trim()) this.data.embeddingApiKey = await this.encrypt(request.embeddingApiKey.trim());
    const temporaryPath = `${this.settingsPath}.tmp`;
    await promises.writeFile(temporaryPath, `${JSON.stringify(this.data, null, 2)}
`, { mode: 384 });
    await promises.rename(temporaryPath, this.settingsPath);
    await promises.chmod(this.settingsPath, 384);
    return this.publicSettings();
  }
  lastWorkspacePath() {
    return this.data.lastWorkspacePath;
  }
  async rememberWorkspacePath(rootPath) {
    this.data.lastWorkspacePath = rootPath;
    const temporaryPath = `${this.settingsPath}.tmp`;
    await promises.writeFile(temporaryPath, `${JSON.stringify(this.data, null, 2)}
`, { mode: 384 });
    await promises.rename(temporaryPath, this.settingsPath);
    await promises.chmod(this.settingsPath, 384);
  }
  async apiConfiguration(overrides = {}) {
    return {
      apiKey: overrides.apiKey?.trim() || (this.data.apiKey ? await this.decrypt(this.data.apiKey) : process.env.OPENAI_API_KEY),
      baseUrl: this.validateUrl(overrides.baseUrl || this.data.apiBaseUrl || process.env.OPENAI_BASE_URL || defaultBaseUrl),
      model: overrides.model?.trim() || this.data.apiModel || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL
    };
  }
  async embeddingConfiguration(overrides = {}) {
    return {
      enabled: overrides.enabled ?? this.data.embeddingEnabled !== false,
      provider: "openai-compatible",
      apiKey: overrides.apiKey?.trim() || (this.data.embeddingApiKey ? await this.decrypt(this.data.embeddingApiKey) : process.env.FORGE_EMBEDDING_API_KEY),
      baseUrl: this.validateUrl(overrides.baseUrl || this.data.embeddingBaseUrl || process.env.FORGE_EMBEDDING_BASE_URL || DEFAULT_EMBEDDING_BASE_URL),
      model: overrides.model?.trim() || this.data.embeddingModel || process.env.FORGE_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL
    };
  }
  async githubCredentials() {
    if (!this.data.githubToken) return null;
    return {
      username: this.data.githubUsername?.trim() || "x-access-token",
      token: await this.decrypt(this.data.githubToken),
      askPassPath: this.askPassPath
    };
  }
  async testGitHub() {
    const credentials = await this.githubCredentials();
    if (!credentials) throw new Error("Save a GitHub token before testing the connection.");
    const response = await fetch("https://api.github.com/user", {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${credentials.token}`, "User-Agent": "FORGE-desktop" }
    });
    if (!response.ok) throw new Error(`GitHub authentication failed (${response.status}).`);
    const profile = await response.json();
    if (!profile.login) throw new Error("GitHub did not return an account login.");
    return { login: profile.login };
  }
  webResearchEnabled() {
    return this.data.webResearchEnabled === true;
  }
  updateChannel() {
    return normalizeUpdateChannel(this.data.updateChannel);
  }
  hermesConfiguration() {
    return { command: this.data.hermesCommand, endpoint: this.data.hermesEndpoint };
  }
  validateUrl(value) {
    const parsed = new URL(value.trim());
    if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("API base URL must use HTTPS or HTTP.");
    if (parsed.username || parsed.password) throw new Error("API base URL must not contain credentials.");
    const loopback = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname.toLowerCase());
    if (parsed.protocol === "http:" && !loopback) throw new Error("Remote API base URLs must use HTTPS. HTTP is allowed only for loopback providers.");
    return parsed.toString().replace(/\/$/, "");
  }
  validateCommand(value) {
    if (value.length > 1024 || /[\0\r\n]/.test(value)) throw new Error("Hermes command must be a bounded executable path or command name.");
    return value;
  }
  async encrypt(value) {
    if (!this.encryptionAvailable) throw new Error("Secure OS credential storage is not available. Secrets were not saved.");
    return (await safeStorage.encryptStringAsync(value)).toString("base64");
  }
  async decrypt(value) {
    if (!this.encryptionAvailable) throw new Error("Secure OS credential storage is not available.");
    return (await safeStorage.decryptStringAsync(Buffer.from(value, "base64"))).result;
  }
}
class ToolRegistry {
  definitions = /* @__PURE__ */ new Map();
  register(definition2) {
    if (!/^[a-z]+(?:\.[a-z]+)+$/.test(definition2.name)) throw new Error(`Invalid tool name: ${definition2.name}`);
    if (this.definitions.has(definition2.name)) throw new Error(`Duplicate tool name: ${definition2.name}`);
    this.definitions.set(definition2.name, definition2);
  }
  get(name) {
    return this.definitions.get(name);
  }
  list() {
    return [...this.definitions.values()];
  }
  parse(call) {
    const definition2 = this.definitions.get(call.name);
    if (!definition2) throw new ToolValidationError("UNKNOWN_TOOL", `Unknown tool name: ${call.name}`);
    const parsed = definition2.inputSchema.safeParse(call.arguments);
    if (!parsed.success) throw new ToolValidationError("MALFORMED_ARGUMENTS", `Invalid arguments for ${call.name}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
    return { definition: definition2, input: parsed.data };
  }
}
class ToolValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
const MAX_TEXT_BYTES = 2e6;
const MAX_RANGED_TEXT_BYTES = 64e6;
const MAX_SEARCH_RESULTS = 2e4;
const MAX_LIST_ENTRIES = 1e4;
const textOutput = z.object({ success: z.boolean() }).passthrough();
const filePath = z.string().min(1).max(4096).refine((value) => !value.includes("\0"), "Path must not contain a null byte.");
const relativePath = filePath.refine((value) => !path__default.isAbsolute(value) && !value.split(/[\\/]/).includes(".."), "Repository path must be relative.");
const reason = z.string().min(3).max(2e3);
const inside = (root, candidate) => candidate === root || candidate.startsWith(`${root}${path__default.sep}`);
const skippableFileSystemError = (error) => error instanceof Error && "code" in error && ["EACCES", "EPERM", "ENOENT"].includes(String(error.code));
const displayPath = (root, candidate) => inside(root, candidate) ? path__default.relative(root, candidate) || "." : candidate;
function isWithin(root, candidate) {
  const relative = path__default.relative(root, candidate);
  return relative === "" || !relative.startsWith(`..${path__default.sep}`) && relative !== ".." && !path__default.isAbsolute(relative);
}
async function resolveExistingParent(candidate, allowMissing) {
  if (!allowMissing) return promises.realpath(candidate);
  const suffix = [];
  let existing = candidate;
  while (true) {
    try {
      await promises.lstat(existing);
      return path__default.resolve(await promises.realpath(existing), ...suffix.reverse());
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
      const parent = path__default.dirname(existing);
      if (parent === existing) throw error;
      suffix.push(path__default.basename(existing));
      existing = parent;
    }
  }
}
async function resolveScopedPath(policy, requestedPath, allowMissing = false) {
  if (!requestedPath || requestedPath.includes("\0")) throw new Error("A non-empty path without null bytes is required.");
  const requested = requestedPath === "~" ? os.homedir() : requestedPath.startsWith("~/") || requestedPath.startsWith(`~${path__default.sep}`) ? path__default.join(os.homedir(), requestedPath.slice(2)) : requestedPath;
  const candidate = await resolveExistingParent(path__default.resolve(policy.workspaceRoot, requested), allowMissing);
  let allowedRoot;
  if (policy.scope === "workspace") allowedRoot = await promises.realpath(policy.workspaceRoot);
  else if (policy.scope === "repository") {
    if (!policy.repositoryRoot) throw new Error("Repository scope is unavailable because the active Git repository root could not be identified.");
    allowedRoot = await promises.realpath(policy.repositoryRoot);
  } else if (policy.scope === "project-tree") {
    if (!policy.projectTreeRoot) throw new Error("Project-tree scope requires a selected project root in Settings.");
    allowedRoot = await promises.realpath(policy.projectTreeRoot);
  } else if (policy.scope === "home") allowedRoot = await promises.realpath(os.homedir());
  if (allowedRoot && !isWithin(allowedRoot, candidate)) {
    throw new Error(`SCOPE_FAILURE: Resolved path ${candidate} is outside the configured ${policy.scope} scope (${allowedRoot}).`);
  }
  return candidate;
}
function unifiedDiff(filePath2, before, after) {
  if (before === after) return "";
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  const lines = [`--- a/${filePath2}`, `+++ b/${filePath2}`, `@@ -1,${oldLines.length} +1,${newLines.length} @@`];
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) {
    lines.push(` ${oldLines[prefix]}`);
    prefix += 1;
  }
  for (let index = prefix; index < oldLines.length; index += 1) lines.push(`-${oldLines[index]}`);
  for (let index = prefix; index < newLines.length; index += 1) lines.push(`+${newLines[index]}`);
  return lines.join("\n").slice(0, 25e4);
}
async function readText(absolute, maxBytes = MAX_TEXT_BYTES) {
  const [buffer, stat] = await Promise.all([promises.readFile(absolute), promises.stat(absolute)]);
  if (buffer.byteLength > maxBytes) throw new Error(`File exceeds the supported ${maxBytes.toLocaleString()} byte text size limit.`);
  if (buffer.includes(0)) throw new Error("Binary content must be requested with file.readBinary.");
  const bom = buffer.length >= 3 && buffer[0] === 239 && buffer[1] === 187 && buffer[2] === 191;
  return { content: buffer.subarray(bom ? 3 : 0).toString("utf8"), encoding: bom ? "utf8-bom" : "utf8", mode: stat.mode };
}
async function atomicWrite(absolute, content, encoding = "utf8", mode) {
  await promises.mkdir(path__default.dirname(absolute), { recursive: true });
  const temporary = path__default.join(path__default.dirname(absolute), `.${path__default.basename(absolute)}.${randomUUID()}.tmp`);
  const data = Buffer.from(`${encoding === "utf8-bom" ? "\uFEFF" : ""}${content}`, "utf8");
  try {
    await promises.writeFile(temporary, data, { flag: "wx", mode });
    await promises.rename(temporary, absolute);
  } catch (error) {
    await promises.rm(temporary, { force: true }).catch(() => void 0);
    throw error;
  }
}
async function backupPath(root, relative) {
  const hash2 = createHash("sha256").update(`${Date.now()}\0${relative}`).digest("hex").slice(0, 12);
  const absolute = path__default.resolve(root, relative);
  const backupName = inside(root, absolute) ? path__default.relative(root, absolute) : path__default.join("external", path__default.basename(absolute));
  const destination = path__default.join(root, ".forge", "backups", `${Date.now()}-${hash2}`, backupName);
  await promises.mkdir(path__default.dirname(destination), { recursive: true });
  return destination;
}
const definition = (value) => value;
function createToolRegistry() {
  const registry = new ToolRegistry();
  const base = { outputSchema: textOutput, cancellable: true };
  registry.register(definition({ ...base, name: "file.list", purpose: "List files and hidden entries at a relative, parent, home, or absolute directory path. Omit path for the active workspace root. Continue with the returned offset when truncated.", inputSchema: z.object({ path: filePath.default("."), recursive: z.boolean().default(false), maxDepth: z.number().int().min(0).max(20).default(2), maxEntries: z.number().int().min(1).max(MAX_LIST_ENTRIES).default(500), offset: z.number().int().min(0).max(1e6).default(0) }), sideEffect: "read", workspaceBoundary: "required", timeoutMs: 1e4, audit: { category: "filesystem", recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.path ?? ".", describeEffect: () => "Read a bounded directory listing, beginning at the workspace root by default." }));
  registry.register(definition({ ...base, name: "file.read", purpose: "Read a bounded range of any accessible text file, including hidden and absolute paths. Use file.readBinary for binary content.", inputSchema: z.object({ path: filePath, startLine: z.number().int().min(1).optional(), endLine: z.number().int().min(1).optional(), offset: z.number().int().min(0).max(MAX_RANGED_TEXT_BYTES).optional(), maxCharacters: z.number().int().min(1).max(2e5).default(12e3) }).refine((input) => input.endLine === void 0 || input.startLine === void 0 || input.endLine >= input.startLine, "endLine must not precede startLine.").refine((input) => input.offset === void 0 || input.startLine === void 0 && input.endLine === void 0, "offset cannot be combined with line ranges."), sideEffect: "read", workspaceBoundary: "required", timeoutMs: 1e4, audit: { category: "filesystem", recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.path, describeEffect: () => "Read bounded text without changing the workspace." }));
  registry.register(definition({ ...base, name: "file.read.binary", purpose: "Read bounded binary content at any accessible path as base64 together with file metadata.", inputSchema: z.object({ path: filePath, maxBytes: z.number().int().min(1).max(25e6).default(2e6) }), sideEffect: "read", workspaceBoundary: "required", timeoutMs: 2e4, audit: { category: "filesystem", recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.path, describeEffect: () => "Read binary bytes as bounded base64 without changing the workspace." }));
  registry.register(definition({ ...base, name: "file.search", purpose: "Search accessible text files, including hidden files and paths outside the active workspace. When truncated, continue using the returned offset.", inputSchema: z.object({ query: z.string().min(1).max(500), path: filePath.default("."), caseSensitive: z.boolean().default(false), maxResults: z.number().int().min(1).max(MAX_SEARCH_RESULTS).default(50), offset: z.number().int().min(0).max(1e5).default(0) }), sideEffect: "read", workspaceBoundary: "required", timeoutMs: 2e4, audit: { category: "filesystem", recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.path ?? ".", describeEffect: (input) => `Search workspace text for ${JSON.stringify(input.query)}.` }));
  registry.register(definition({ ...base, name: "file.create", purpose: "Create a file at any accessible path.", inputSchema: z.object({ path: filePath, content: z.string().max(MAX_TEXT_BYTES), reason }), sideEffect: "workspace-write", workspaceBoundary: "required", timeoutMs: 1e4, audit: { category: "filesystem", recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.path, describeEffect: () => "Create a new file atomically." }));
  registry.register(definition({ ...base, name: "file.write", purpose: "Replace an accessible text file after showing a diff.", inputSchema: z.object({ path: filePath, content: z.string().max(MAX_TEXT_BYTES), reason }), sideEffect: "workspace-write", workspaceBoundary: "required", timeoutMs: 1e4, audit: { category: "filesystem", recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.path, describeEffect: () => "Atomically write the diff with a rollback backup." }));
  registry.register(definition({ ...base, name: "file.patch", purpose: "Apply a targeted text replacement to an accessible file.", inputSchema: z.object({ path: filePath, expected: z.string().min(1).max(MAX_TEXT_BYTES), replacement: z.string().max(MAX_TEXT_BYTES), replaceAll: z.boolean().default(false), reason }), sideEffect: "workspace-write", workspaceBoundary: "required", timeoutMs: 1e4, audit: { category: "filesystem", recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.path, describeEffect: () => "Apply the displayed targeted patch atomically." }));
  for (const name of ["file.rename", "file.move"]) registry.register(definition({ ...base, name, purpose: "Move an accessible path without overwriting.", inputSchema: z.object({ from: filePath, to: filePath, reason }), sideEffect: "workspace-write", workspaceBoundary: "required", timeoutMs: 1e4, audit: { category: "filesystem", recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => `${input.from} → ${input.to}`, describeEffect: () => "Move the path without overwriting the destination." }));
  registry.register(definition({ ...base, name: "directory.create", purpose: "Create a directory at any accessible path.", inputSchema: z.object({ path: filePath, reason }), sideEffect: "workspace-write", workspaceBoundary: "required", timeoutMs: 1e4, audit: { category: "filesystem", recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.path, describeEffect: () => "Create a directory at the requested path." }));
  registry.register(definition({ ...base, name: "file.delete", purpose: "Delete an accessible path after creating a rollback backup.", inputSchema: z.object({ path: filePath, reason }), sideEffect: "destructive", workspaceBoundary: "required", timeoutMs: 2e4, audit: { category: "filesystem", recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.path, describeEffect: () => "Back up then delete the selected source path." }));
  registry.register(definition({ ...base, name: "terminal.read", purpose: "Read bounded recent output from an existing user terminal session.", inputSchema: z.object({ sessionId: z.string().uuid().optional(), maxCharacters: z.number().int().min(100).max(2e4).default(4e3) }), sideEffect: "read", workspaceBoundary: "required", timeoutMs: 5e3, audit: { category: "shell", recordsAffectedPaths: false, recordsExitCode: true, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.sessionId ?? "all terminal sessions", describeEffect: () => "Read bounded, redacted recent terminal evidence without changing the session." }));
  const gitRead = (name, schema, effect) => registry.register(definition({ ...base, name, purpose: effect, inputSchema: schema, sideEffect: "read", workspaceBoundary: "required", timeoutMs: 2e4, audit: { category: "git", recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: () => "active Git workspace", describeEffect: () => effect }));
  gitRead("git.status", z.object({}), "Inspect current branch and working tree status.");
  gitRead("git.diff", z.object({ staged: z.boolean().default(false) }), "Inspect the Git diff.");
  gitRead("git.log", z.object({ limit: z.number().int().min(1).max(100).default(30) }), "Inspect recent Git history.");
  gitRead("git.branches", z.object({}), "Inspect Git branches.");
  for (const name of ["git.stage", "git.unstage"]) registry.register(definition({ ...base, name, purpose: `${name === "git.stage" ? "Stage" : "Unstage"} selected Git paths.`, inputSchema: z.object({ files: z.array(relativePath).min(1).max(200), reason }), sideEffect: "workspace-write", workspaceBoundary: "required", timeoutMs: 2e4, audit: { category: "git", recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.files.join(", "), describeEffect: () => `${name === "git.stage" ? "Stage" : "Unstage"} only the listed paths.` }));
  registry.register(definition({ ...base, name: "git.commit", purpose: "Commit the exact staged Git paths.", inputSchema: z.object({ message: z.string().min(1).max(5e3), reason }), sideEffect: "repository-write", workspaceBoundary: "required", timeoutMs: 6e4, audit: { category: "git", recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: () => "current branch and staged files", describeEffect: (input) => `Create a commit with message ${JSON.stringify(input.message)}.` }));
  for (const name of ["git.pull", "git.push"]) registry.register(definition({ ...base, name, purpose: `${name === "git.pull" ? "Pull from" : "Push to"} the configured remote.`, inputSchema: z.object({ reason }), sideEffect: "write-network", workspaceBoundary: "required", timeoutMs: 12e4, audit: { category: "git", recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: true }, networkAccess: true, describeTarget: () => "origin and current branch", describeEffect: () => `${name === "git.pull" ? "Receive remote changes" : "Send local commits"} using protected Git credentials.` }));
  registry.register(definition({ ...base, name: "shell.run", purpose: "Run one executable with a separate argument array. Use bash -lc for shell operators, pipes, redirects, globbing, or substitutions.", inputSchema: z.object({ command: z.string().min(1).max(4096).describe("Executable name only, such as hermes, sha256sum, or bash. Do not include arguments in this field."), args: z.array(z.string().max(32e3)).max(500).default([]).describe('Arguments as separate array entries. For shell syntax use ["-lc", "<script>"] with command "bash".'), workingDirectory: filePath.optional().describe("Absolute or relative cwd. Relative paths start at the active workspace root."), timeoutMs: z.number().int().min(100).max(6e5).default(12e4), environment: z.record(z.string()).optional(), environmentAllowlist: z.array(z.string()).max(100).default([]), networkProfile: z.enum(["offline", "network", "package-manager", "git"]).default("offline"), reason, expectedOutcome: z.string().min(1).max(2e3) }), sideEffect: "process", workspaceBoundary: "required", timeoutMs: 6e5, audit: { category: "shell", recordsAffectedPaths: true, recordsExitCode: true, externalDataTransfer: false }, networkAccess: true, describeTarget: (input) => [input.command, ...input.args ?? []].map(quoteArgument).join(" "), describeEffect: (input) => `${input.expectedOutcome} Network profile: ${input.networkProfile}.` }));
  registry.register(definition({ ...base, name: "web.search", purpose: "Search the public web when external research is enabled. Workspace content is never sent automatically.", inputSchema: z.object({ query: z.string().min(1).max(1e3), reason, projectDataSent: z.literal("None").default("None") }), sideEffect: "read-network", workspaceBoundary: "not-applicable", timeoutMs: 3e4, audit: { category: "web", recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: true }, networkAccess: true, describeTarget: (input) => input.query, describeEffect: () => "Send the exact public query to an external search service and return cited results." }));
  registry.register(definition({ ...base, name: "web.fetch", purpose: "Retrieve a public HTTP(S) resource when external research is enabled. Workspace content is never sent automatically.", inputSchema: z.object({ url: z.string().url().max(8e3), reason, projectDataSent: z.literal("None").default("None") }), sideEffect: "read-network", workspaceBoundary: "not-applicable", timeoutMs: 3e4, audit: { category: "web", recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: true }, networkAccess: true, describeTarget: (input) => input.url, describeEffect: () => "Retrieve bounded public web evidence without browser automation." }));
  registry.register(definition({ ...base, name: "browser.open", purpose: "Open a validated public HTTP(S) URL in the user-visible FORGE Browser.", inputSchema: z.object({ url: z.string().url().max(8e3), reason, projectDataSent: z.literal("None").default("None") }), sideEffect: "read-network", workspaceBoundary: "not-applicable", timeoutMs: 45e3, audit: { category: "web", recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: true }, networkAccess: true, describeTarget: (input) => input.url, describeEffect: () => "Navigate the visible FORGE Browser to this public URL. The destination and any rendered content remain external data." }));
  registry.register(definition({ ...base, name: "browser.read", purpose: "Read bounded rendered text from the current visible FORGE Browser page.", inputSchema: z.object({ reason }), sideEffect: "read-network", workspaceBoundary: "not-applicable", timeoutMs: 2e4, audit: { category: "web", recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: true }, networkAccess: false, describeTarget: () => "the current FORGE Browser page", describeEffect: () => "Send bounded rendered page text from the current public page to the configured model for analysis." }));
  registry.register(definition({ ...base, name: "browser.find", purpose: "Find bounded text excerpts on the current visible FORGE Browser page.", inputSchema: z.object({ query: z.string().min(1).max(1e3), maxResults: z.number().int().min(1).max(50).default(10), reason }), sideEffect: "read-network", workspaceBoundary: "not-applicable", timeoutMs: 2e4, audit: { category: "web", recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: true }, networkAccess: false, describeTarget: () => "the current FORGE Browser page", describeEffect: (input) => `Send excerpts matching ${JSON.stringify(input.query)} from the current public page to the configured model.` }));
  registry.register(definition({ ...base, name: "browser.savecontext", purpose: "Save an agent-authored summary of the current browser page as durable workspace context.", inputSchema: z.object({ title: z.string().min(1).max(500), content: z.string().min(1).max(2e5), reason }), workspaceBoundary: "required", timeoutMs: 15e3, audit: { category: "memory", recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, sideEffect: "workspace-write", describeTarget: (input) => `durable workspace context: ${input.title}`, describeEffect: () => "Persist the supplied browser-page summary in workspace-owned durable memory. It can be removed from Durable Memory later." }));
  registry.register(definition({ ...base, name: "github.read", purpose: "Inspect metadata, branches, commits, issues, pull requests, comments, workflow state, releases, or assets for the active GitHub repository.", inputSchema: z.object({ resource: z.enum(["metadata", "branches", "commits", "issues", "pulls", "issue-comments", "pull-comments", "workflow-runs", "workflow-jobs", "releases", "release-assets"]), number: z.number().int().positive().optional(), runId: z.number().int().positive().optional(), releaseId: z.number().int().positive().optional(), page: z.number().int().min(1).max(100).default(1), reason }), sideEffect: "read-network", workspaceBoundary: "required", timeoutMs: 3e4, audit: { category: "git", recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: true }, networkAccess: true, describeTarget: (input) => `GitHub ${input.resource}`, describeEffect: () => "Read bounded GitHub repository evidence using the active origin." }));
  const githubMutationContext = { reason };
  const githubMutation = z.discriminatedUnion("action", [
    z.object({ action: z.literal("create-issue"), title: z.string().min(1).max(500), body: z.string().max(65e3).optional(), labels: z.array(z.string().max(100)).max(100).optional(), assignees: z.array(z.string().max(100)).max(100).optional(), ...githubMutationContext }),
    z.object({ action: z.literal("update-issue"), number: z.number().int().positive(), title: z.string().min(1).max(500).optional(), body: z.string().max(65e3).optional(), state: z.enum(["open", "closed"]).optional(), labels: z.array(z.string().max(100)).max(100).optional(), assignees: z.array(z.string().max(100)).max(100).optional(), ...githubMutationContext }),
    z.object({ action: z.literal("comment-issue"), number: z.number().int().positive(), body: z.string().min(1).max(65e3), ...githubMutationContext }),
    z.object({ action: z.literal("create-branch"), branch: z.string().min(1).max(255).regex(/^[A-Za-z0-9._/-]+$/), sha: z.string().min(7).max(100), ...githubMutationContext }),
    z.object({ action: z.literal("create-file"), path: relativePath, message: z.string().min(1).max(500), content: z.string().min(1).max(2e6), branch: z.string().min(1).max(255).optional(), sha: z.string().min(7).max(100).optional(), ...githubMutationContext }),
    z.object({ action: z.literal("create-pull-request"), title: z.string().min(1).max(500), head: z.string().min(1).max(500), base: z.string().min(1).max(500), body: z.string().max(65e3).optional(), draft: z.boolean().optional(), ...githubMutationContext }),
    z.object({ action: z.literal("comment-pull-request"), number: z.number().int().positive(), body: z.string().min(1).max(65e3), ...githubMutationContext }),
    z.object({ action: z.literal("retry-workflow"), runId: z.number().int().positive(), ...githubMutationContext }),
    z.object({ action: z.literal("create-release"), tag_name: z.string().min(1).max(255), target_commitish: z.string().min(1).max(255).optional(), name: z.string().max(500).optional(), body: z.string().max(65e3).optional(), draft: z.boolean().optional(), prerelease: z.boolean().optional(), ...githubMutationContext }),
    z.object({ action: z.literal("update-release"), releaseId: z.number().int().positive(), tag_name: z.string().min(1).max(255).optional(), target_commitish: z.string().min(1).max(255).optional(), name: z.string().max(500).optional(), body: z.string().max(65e3).optional(), draft: z.boolean().optional(), prerelease: z.boolean().optional(), ...githubMutationContext })
  ]).superRefine((input, context) => {
    if (input.action === "update-issue" && input.title === void 0 && input.body === void 0 && input.state === void 0 && input.labels === void 0 && input.assignees === void 0) context.addIssue({ code: z.ZodIssueCode.custom, message: "An issue update requires at least one changed field." });
    if (input.action === "update-release" && input.tag_name === void 0 && input.target_commitish === void 0 && input.name === void 0 && input.body === void 0 && input.draft === void 0 && input.prerelease === void 0) context.addIssue({ code: z.ZodIssueCode.custom, message: "A release update requires at least one changed field." });
  });
  registry.register(definition({ ...base, name: "github.mutate", purpose: "Perform one typed GitHub repository mutation through the official REST API.", inputSchema: githubMutation, sideEffect: "write-network", workspaceBoundary: "required", timeoutMs: 6e4, audit: { category: "git", recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: true }, networkAccess: true, describeTarget: (input) => `GitHub ${input.action}`, describeEffect: () => "Send one authenticated, audited GitHub API mutation for the active repository." }));
  const taskStepDraft = z.object({ id: z.string().min(1).max(200).optional(), name: z.string().min(1).max(300), purpose: z.string().min(1).max(2e3), riskTier: z.union([z.literal(0), z.literal(1), z.literal(2)]), requiredTool: z.string().max(200).optional(), expectedInput: z.unknown().optional(), expectedOutput: z.unknown().optional(), retryPolicy: z.object({ maxAttempts: z.number().int().min(1).max(20).optional(), backoffMs: z.number().int().min(0).max(864e5).optional(), retryableErrorCodes: z.array(z.string().max(100)).max(50).optional() }).optional(), timeoutMs: z.number().int().min(100).max(864e5).optional(), artifactPaths: z.array(relativePath).max(200).optional(), verificationCriteria: z.array(z.string().min(1).max(1e3)).min(1).max(100), rollbackInstructions: z.string().max(4e3).optional(), dependencies: z.array(z.string().min(1).max(200)).max(100).optional() });
  const taskDraft = z.object({ title: z.string().min(1).max(300), description: z.string().max(1e4).optional(), taskType: z.string().min(1).max(100), priority: z.enum(["low", "medium", "high"]).optional(), originatingConversationId: z.string().uuid().optional(), assignedProvider: z.string().max(200).optional(), assignedModel: z.string().max(200).optional(), progressSummary: z.string().max(4e3).optional(), resumeInstructions: z.string().min(1).max(1e4), associatedBranch: z.string().max(500).optional(), associatedCommitSha: z.string().max(100).optional(), associatedPullRequest: z.string().max(2e3).optional(), associatedReleaseTag: z.string().max(500).optional(), associatedWorkflowRun: z.string().max(500).optional(), taskDependencies: z.array(z.string().uuid()).max(100).optional(), steps: z.array(taskStepDraft).max(500) });
  registry.register(definition({ ...base, name: "task.inspect", purpose: "Inspect one workspace-owned persistent task and its verified checkpoints.", inputSchema: z.object({ taskId: z.string().uuid() }), sideEffect: "read", workspaceBoundary: "required", timeoutMs: 5e3, audit: { category: "memory", recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.taskId, describeEffect: () => "Read persistent task state without changing it." }));
  registry.register(definition({ ...base, name: "task.create", purpose: "Create a draft workspace-owned task without executing any step.", inputSchema: taskDraft.extend({ reason }), sideEffect: "workspace-write", workspaceBoundary: "required", timeoutMs: 1e4, audit: { category: "memory", recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.title, describeEffect: () => "Persist a draft task and its structured steps; no executable work will start." }));
  for (const name of ["task.resume", "task.pause", "task.cancel"]) registry.register(definition({ ...base, name, purpose: `${name.slice(5)} a workspace-owned task .`, inputSchema: z.object({ taskId: z.string().uuid(), reason, trackingOnly: z.boolean().default(true) }), sideEffect: "workspace-write", workspaceBoundary: "required", timeoutMs: 2e4, audit: { category: "memory", recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => input.taskId, describeEffect: () => `${name.slice(5)} task tracking without changing execution policy.` }));
  registry.register(definition({ ...base, name: "task.checkpoint", purpose: "Record a checkpoint for the active task step; FORGE supplies task and audit identities internally.", inputSchema: z.object({ name: z.string().min(1).max(300), summary: z.string().min(1).max(4e3), verified: z.boolean().default(false), evidence: z.unknown().optional(), reason }), sideEffect: "workspace-write", workspaceBoundary: "required", timeoutMs: 1e4, audit: { category: "memory", recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: () => "the active workspace task step", describeEffect: () => "Persist a structured checkpoint without executing another tool." }));
  registry.register(definition({ ...base, name: "task.handoff", purpose: "Generate a Markdown projection of the active workspace task.", inputSchema: z.object({ reason }), sideEffect: "workspace-write", workspaceBoundary: "required", timeoutMs: 1e4, audit: { category: "memory", recordsAffectedPaths: true, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: () => ".forge/handoffs for the active task", describeEffect: () => "Atomically write or update a human-readable task handoff." }));
  registry.register(definition({ ...base, name: "task.process.start", purpose: "Start one task step as a detached workspace-owned process with file-backed output.", inputSchema: z.object({ command: z.string().min(1).max(4096).describe("Executable name only; put every argument in args."), args: z.array(z.string().max(32e3)).max(500).default([]).describe('Arguments as separate array entries; use bash with ["-lc", "<script>"] for shell syntax.'), workingDirectory: filePath.optional().describe("Absolute or relative cwd. Relative paths start at the active workspace root."), timeoutMs: z.number().int().min(100).max(864e5).default(6e5), environment: z.record(z.string()).optional(), environmentAllowlist: z.array(z.string()).max(100).default([]), networkProfile: z.enum(["offline", "network", "package-manager", "git"]).default("offline"), reason, expectedOutcome: z.string().min(1).max(2e3) }), sideEffect: "process", workspaceBoundary: "required", timeoutMs: 3e4, audit: { category: "shell", recordsAffectedPaths: true, recordsExitCode: true, externalDataTransfer: false }, networkAccess: true, describeTarget: (input) => [input.command, ...input.args ?? []].map(quoteArgument).join(" "), describeEffect: (input) => `${input.expectedOutcome} Output will be stored under .forge/task-output and execution may outlive the current conversation. Network profile: ${input.networkProfile}.` }));
  registry.register(definition({ ...base, name: "task.redirect", purpose: "Queue a natural-language instruction for the active task at its next safe continuation boundary.", inputSchema: z.object({ taskId: z.string().uuid(), instruction: z.string().min(1).max(4e3), reason }), sideEffect: "workspace-write", workspaceBoundary: "required", timeoutMs: 1e4, audit: { category: "memory", recordsAffectedPaths: false, recordsExitCode: false, externalDataTransfer: false }, networkAccess: false, describeTarget: (input) => `task ${input.taskId}`, describeEffect: () => "Persist a redirect instruction in task history until the running agent acknowledges delivery." }));
  return registry;
}
function quoteArgument(value) {
  return /^[A-Za-z0-9_./:=+-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
}
const SHELL_TOOL_NAMES = /* @__PURE__ */ new Set(["shell.run", "task.process.start"]);
function normalizeCommandLine(commandLine) {
  const script = commandLine.trim();
  if (!script) throw new ToolValidationError("MALFORMED_ARGUMENTS", "A non-empty executable or command line is required.");
  const args = [];
  let token = "";
  let tokenStarted = false;
  let quote = null;
  let requiresShell = false;
  const finishToken = () => {
    if (!tokenStarted) return;
    args.push(token);
    token = "";
    tokenStarted = false;
  };
  for (let index = 0; index < script.length; index += 1) {
    const character = script[index];
    if (quote === "single") {
      if (character === "'") quote = null;
      else token += character;
      continue;
    }
    if (quote === "double") {
      if (character === '"') {
        quote = null;
        continue;
      }
      if (character === "$" || character === "`") {
        requiresShell = true;
        break;
      }
      if (character === "\\" && index + 1 < script.length) {
        const next = script[++index];
        token += ["$", "`", '"', "\\"].includes(next) ? next : `\\${next}`;
      } else token += character;
      continue;
    }
    if (character === "\n" || character === "\r") {
      requiresShell = true;
      break;
    }
    if (/\s/.test(character)) {
      finishToken();
      continue;
    }
    if (character === "'") {
      quote = "single";
      tokenStarted = true;
      continue;
    }
    if (character === '"') {
      quote = "double";
      tokenStarted = true;
      continue;
    }
    if (character === "\\") {
      if (index + 1 >= script.length) throw new ToolValidationError("MALFORMED_ARGUMENTS", "Command line ends with an incomplete escape.");
      token += script[++index];
      tokenStarted = true;
      continue;
    }
    if (";&|<>`$(){}".includes(character) || character === "*" || character === "?" || character === "[" || character === "#" && !tokenStarted || character === "~" && !tokenStarted) {
      requiresShell = true;
      break;
    }
    token += character;
    tokenStarted = true;
  }
  if (requiresShell) return { command: "bash", args: ["-lc", script] };
  if (quote) throw new ToolValidationError("MALFORMED_ARGUMENTS", `Command line contains an unterminated ${quote}-quoted argument.`);
  finishToken();
  if (!args.length) throw new ToolValidationError("MALFORMED_ARGUMENTS", "A non-empty executable is required.");
  if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(args[0])) return { command: "bash", args: ["-lc", script] };
  if (["cd", "source", "export", "alias", "unalias", "set", "unset", "ulimit"].includes(args[0])) return { command: "bash", args: ["-lc", script] };
  return { command: args[0], args: args.slice(1) };
}
function normalizeShellToolCall(call) {
  if (!SHELL_TOOL_NAMES.has(call.name)) return call;
  if (typeof call.arguments === "string") return normalizeShellToolCall({ ...call, arguments: { command: call.arguments } });
  if (Array.isArray(call.arguments)) {
    if (!call.arguments.length || !call.arguments.every((argument) => typeof argument === "string")) throw new ToolValidationError("MALFORMED_ARGUMENTS", "Shell command arrays must contain non-empty string arguments.");
    return normalizeShellToolCall({ ...call, arguments: { command: call.arguments[0], args: call.arguments.slice(1) } });
  }
  if (!call.arguments || typeof call.arguments !== "object") return call;
  const argumentsValue = call.arguments;
  if (Array.isArray(argumentsValue.command)) {
    if (!argumentsValue.command.length || !argumentsValue.command.every((argument) => typeof argument === "string")) throw new ToolValidationError("MALFORMED_ARGUMENTS", "Shell command arrays must contain non-empty string arguments.");
    return normalizeShellToolCall({ ...call, arguments: { ...argumentsValue, command: argumentsValue.command[0], args: [...argumentsValue.command.slice(1), ...Array.isArray(argumentsValue.args) ? argumentsValue.args : []] } });
  }
  if (typeof argumentsValue.command !== "string") return call;
  const suppliedArgs = argumentsValue.args;
  if (typeof suppliedArgs === "string") return normalizeShellToolCall({ ...call, arguments: { ...argumentsValue, command: `${argumentsValue.command} ${suppliedArgs}`, args: [] } });
  if (suppliedArgs !== void 0 && !Array.isArray(suppliedArgs)) return call;
  if (Array.isArray(suppliedArgs) && suppliedArgs.length > 0) {
    if (/\s/.test(argumentsValue.command)) {
      const normalized2 = normalizeCommandLine(argumentsValue.command);
      return { ...call, arguments: { ...argumentsValue, command: normalized2.command, args: [...normalized2.args, ...suppliedArgs] } };
    }
    return call;
  }
  const normalized = normalizeCommandLine(argumentsValue.command);
  return { ...call, arguments: { ...argumentsValue, ...normalized } };
}
function normalizeProviderToolCall(call, userRequest = "") {
  const shellNormalized = normalizeShellToolCall(call);
  if (!shellNormalized.arguments || typeof shellNormalized.arguments !== "object" || Array.isArray(shellNormalized.arguments)) return shellNormalized;
  const input = { ...shellNormalized.arguments };
  if (["file.list", "file.search"].includes(shellNormalized.name) && input.path === "") input.path = ".";
  if (shellNormalized.name === "file.read" && input.offset !== void 0 && (input.startLine !== void 0 || input.endLine !== void 0)) {
    if (/\b(lines?|line numbers?|from line|through line)\b/i.test(userRequest)) delete input.offset;
    else {
      delete input.startLine;
      delete input.endLine;
    }
  }
  return { ...shellNormalized, arguments: input };
}
function inferredNetworkProfile(command, args) {
  const executable = path__default.basename(command).toLowerCase();
  const action = args.find((argument) => !argument.startsWith("-"))?.toLowerCase();
  if (["curl", "wget", "ssh", "scp"].includes(executable)) return "network";
  if (["npm", "npx", "pnpm", "yarn", "bun"].includes(executable) && ["install", "ci", "add", "update", "publish", "dlx", "create"].includes(action ?? "")) return "package-manager";
  if (executable === "git" && ["clone", "fetch", "pull", "push", "ls-remote"].includes(action ?? "")) return "git";
  return "offline";
}
function sanitizeToolData(value) {
  if (Array.isArray(value)) return value.map(sanitizeToolData);
  if (!value || typeof value !== "object") return typeof value === "string" && /(?:sk-|github_pat_|gh[oprsu]_)[A-Za-z0-9_-]{10,}/.test(value) ? "[REDACTED]" : value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, /token|secret|password|authorization|credential|api.?key/i.test(key) ? "[REDACTED]" : sanitizeToolData(entry)]));
}
function boundedToolEvidence(result, limit = 12e3) {
  const text = JSON.stringify(sanitizeToolData({ toolName: result.toolName, success: result.success, output: result.output, error: result.error, affectedPaths: result.affectedPaths, exitCode: result.exitCode, warnings: result.warnings, truncated: result.truncated }), null, 2);
  return text.length > limit ? `${text.slice(0, limit)}
[FORGE bounded the remaining tool output]` : text;
}
function boundedShellAuditOutput(output, limit = 64e3) {
  if (!output || typeof output !== "object") return void 0;
  const value = output;
  const bound = (entry) => typeof entry === "string" && entry.length > limit ? `${entry.slice(0, limit)}
[FORGE bounded the remaining audited output]` : entry;
  return sanitizeToolData({
    executable: value.executable,
    argv: value.argv,
    cwd: value.cwd,
    stdout: bound(value.stdout),
    stderr: bound(value.stderr),
    exitCode: value.exitCode,
    signal: value.signal,
    timedOut: value.timedOut,
    cancelled: value.cancelled,
    truncated: value.truncated
  });
}
const INTERNAL_PROVIDER_ARGUMENTS = /* @__PURE__ */ new Set(["reason", "taskContext", "originatingConversationId", "auditId", "stepId"]);
function modelVisibleToolSchema(schema) {
  const visit2 = (value) => {
    if (Array.isArray(value)) return value.map(visit2);
    if (!value || typeof value !== "object") return value;
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key === "properties" && entry && typeof entry === "object" && !Array.isArray(entry)) {
        output[key] = Object.fromEntries(Object.entries(entry).filter(([property]) => !INTERNAL_PROVIDER_ARGUMENTS.has(property)).map(([property, propertySchema]) => [property, visit2(propertySchema)]));
      } else if (key === "required" && Array.isArray(entry)) {
        output[key] = entry.filter((property) => typeof property !== "string" || !INTERNAL_PROVIDER_ARGUMENTS.has(property));
      } else {
        output[key] = visit2(entry);
      }
    }
    return output;
  };
  return visit2(schema);
}
function inferExecutionReason(definition2, context) {
  const request = context.userRequest?.trim().replace(/\s+/g, " ");
  return request ? `${definition2.purpose} Current user request: ${request}`.slice(0, 2e3) : definition2.purpose.slice(0, 2e3);
}
function enrichRuntimeArguments(argumentsValue, reasonValue, context, toolName) {
  if (!argumentsValue || typeof argumentsValue !== "object" || Array.isArray(argumentsValue)) return argumentsValue;
  const { reason: _providerReason, taskContext: _providerTaskContext, originatingConversationId: _providerConversationId, auditId: _providerAuditId, stepId: _providerStepId, ...semanticArguments } = argumentsValue;
  const inferredProfile = SHELL_TOOL_NAMES.has(toolName) && typeof semanticArguments.command === "string" ? inferredNetworkProfile(semanticArguments.command, Array.isArray(semanticArguments.args) ? semanticArguments.args : []) : "offline";
  const networkProfile = inferredProfile === "offline" ? semanticArguments.networkProfile : inferredProfile;
  const configuredTimeout = toolName === "task.process.start" ? context.backgroundTaskTimeoutMs : context.processTimeoutMs;
  const standardTimeout = toolName === "task.process.start" ? 6e5 : 12e4;
  const timeoutLimit = context.processMode === "full-local-compute" ? configuredTimeout : Math.min(configuredTimeout ?? standardTimeout, standardTimeout);
  const suppliedTimeout = typeof semanticArguments.timeoutMs === "number" ? semanticArguments.timeoutMs : timeoutLimit;
  const cappedTimeout = typeof timeoutLimit === "number" && typeof suppliedTimeout === "number" ? Math.min(suppliedTimeout, timeoutLimit) : void 0;
  return { ...semanticArguments, ...SHELL_TOOL_NAMES.has(toolName) && cappedTimeout !== void 0 ? { timeoutMs: cappedTimeout } : {}, reason: reasonValue, ...SHELL_TOOL_NAMES.has(toolName) && !semanticArguments.expectedOutcome ? { expectedOutcome: reasonValue } : {}, ...SHELL_TOOL_NAMES.has(toolName) && networkProfile ? { networkProfile } : {}, ...toolName === "task.create" ? { originatingConversationId: context.conversationId } : {} };
}
class ToolRouter {
  constructor(dependencies) {
    this.dependencies = dependencies;
    this.registry = createToolRegistry();
    this.installExecutors();
  }
  registry;
  requests = /* @__PURE__ */ new Map();
  controllers = /* @__PURE__ */ new Map();
  executors = /* @__PURE__ */ new Map();
  workspaceRoots = /* @__PURE__ */ new Map();
  requestPathPolicies = /* @__PURE__ */ new Map();
  definitions() {
    return this.registry.list();
  }
  capabilityCatalog(executionMode = "controlled") {
    return this.registry.list().map((entry) => {
      const availability = this.availability(entry.name);
      const modeAllows = executionMode !== "disabled" && (executionMode !== "controlled" || ["read", "read-network"].includes(entry.sideEffect));
      return { name: entry.name, purpose: entry.purpose, category: entry.audit.category, sideEffect: entry.sideEffect, available: availability.available, unavailableReason: availability.reason, registered: true, executorPresent: this.executors.has(entry.name), providerVisible: modeAllows && availability.available, cancellable: entry.cancellable, networkAccess: entry.networkAccess, inputSchema: modelVisibleToolSchema(zodToJsonSchema(entry.inputSchema, { target: "openApi3" })) };
    });
  }
  providerDefinitions(executionMode = "controlled") {
    if (executionMode === "disabled") return [];
    return this.registry.list().filter((entry) => this.availability(entry.name).available && (executionMode !== "controlled" || ["read", "read-network"].includes(entry.sideEffect))).map((entry) => ({ name: entry.name, description: entry.purpose, parameters: modelVisibleToolSchema(zodToJsonSchema(entry.inputSchema, { target: "openApi3" })), sideEffects: entry.sideEffect, networkAccess: entry.networkAccess, cancellation: entry.cancellable, resultSemantics: "Returns a structured, bounded result with success, affected paths, warnings, and recovery metadata when applicable." }));
  }
  listRequests(workspaceId) {
    return [...this.requests.values()].filter((request) => !workspaceId || request.workspaceId === workspaceId).sort((a, b) => b.requestedAt - a.requestedAt).map((request) => ({ ...request, input: sanitizeToolData(request.input) }));
  }
  requestById(id2) {
    const request = this.requests.get(id2);
    return request ? { ...request } : void 0;
  }
  async request(call, context) {
    const definitionForContext = this.registry.get(call.name);
    const executionReason = definitionForContext ? inferExecutionReason(definitionForContext, context) : `Request ${call.name}`;
    let parsed;
    try {
      const normalizedCall = context.autoRepairToolArguments === false ? call : normalizeProviderToolCall(call, context.userRequest);
      const runtimeCall = { ...normalizedCall, arguments: enrichRuntimeArguments(normalizedCall.arguments, executionReason, context, normalizedCall.name) };
      parsed = this.registry.parse(runtimeCall);
    } catch (error) {
      await this.auditValidationFailure(call, context, error);
      throw error;
    }
    const { definition: definition2, input } = parsed;
    const policyFailure = this.policyFailure(definition2, input, context);
    if (policyFailure) {
      const error = new ToolValidationError("POLICY_FAILURE", policyFailure);
      await this.auditValidationFailure(call, context, error);
      throw error;
    }
    const availability = this.availability(definition2.name);
    if (!availability.available) {
      const error = new ToolValidationError("UNKNOWN_TOOL", `${definition2.name} is not available: ${availability.reason ?? "a required FORGE capability is unavailable."}`);
      await this.auditValidationFailure(call, context, error);
      throw error;
    }
    this.workspaceRoots.set(context.workspaceId, context.workspaceRoot);
    const now = Date.now();
    const requestId = call.id || randomUUID();
    const pathPolicy = { workspaceRoot: context.workspaceRoot, scope: context.filesystemScope ?? "workspace", repositoryRoot: context.repositoryRoot, projectTreeRoot: context.projectTreeRoot };
    const prediction = await this.predict(definition2.name, input, pathPolicy).catch(() => ({ paths: [] }));
    const request = {
      id: requestId,
      workspaceId: context.workspaceId,
      conversationId: context.conversationId,
      modelId: context.modelId,
      toolName: definition2.name,
      input,
      executionContext: { requestId, workspaceId: context.workspaceId, conversationId: context.conversationId, modelId: context.modelId, reason: executionReason, ...context.task },
      reason: executionReason,
      target: prediction.target ?? definition2.describeTarget(input),
      workingDirectory: typeof input.workingDirectory === "string" ? input.workingDirectory : void 0,
      expectedEffect: definition2.describeEffect(input),
      predictedAffectedPaths: prediction.paths,
      networkAccess: definition2.networkAccess && (input.networkProfile ?? "network") !== "offline",
      externalDataDescription: typeof input.projectDataSent === "string" ? input.projectDataSent : void 0,
      diff: prediction.diff,
      state: "requested",
      requestedAt: now,
      updatedAt: now
    };
    this.requests.set(request.id, request);
    this.requestPathPolicies.set(request.id, pathPolicy);
    const result = await this.execute(request.id, context);
    return { request: { ...request }, result };
  }
  async cancel(requestId, context) {
    const request = this.required(requestId);
    if (request.workspaceId !== context.workspaceId) throw new Error("Tool request belongs to another workspace.");
    if (request.state === "requested") {
      request.state = "cancelled";
      request.updatedAt = Date.now();
      await this.dependencies.audit.appendAction(this.record(request, "cancelled", false, 0, "Tool request cancelled before execution.", []));
      return true;
    }
    if (request.state !== "running") return false;
    this.controllers.get(requestId)?.abort();
    if (SHELL_TOOL_NAMES.has(request.toolName)) this.dependencies.shell.cancel(requestId);
    return true;
  }
  async cancelAll(workspaceId) {
    const active = [...this.requests.values()].filter((request) => request.workspaceId === workspaceId && ["requested", "running"].includes(request.state));
    let cancelled = 0;
    for (const request of active) if (await this.cancel(request.id, { workspaceId })) cancelled += 1;
    return cancelled;
  }
  async cancelTask(taskId) {
    const active = [...this.requests.values()].filter((request) => request.executionContext.taskId === taskId && ["requested", "running"].includes(request.state));
    let cancelled = 0;
    for (const request of active) if (await this.cancel(request.id, { workspaceId: request.workspaceId })) cancelled += 1;
    return cancelled;
  }
  async execute(requestId, _context) {
    const request = this.required(requestId);
    const definition2 = this.registry.get(request.toolName);
    const executor = this.executors.get(request.toolName);
    if (!executor) throw new Error(`No executor is registered for ${request.toolName}.`);
    request.state = "running";
    request.updatedAt = Date.now();
    const started = Date.now();
    const controller = new AbortController();
    this.controllers.set(request.id, controller);
    try {
      const partial = await executor(request.input, request, controller.signal);
      const output = partial.output === void 0 ? void 0 : definition2.outputSchema.parse(partial.output);
      const result = { ...partial, output, requestId: request.id, toolName: request.toolName, durationMs: Date.now() - started };
      request.state = result.success ? "succeeded" : result.cancelled ? "cancelled" : "failed";
      request.updatedAt = Date.now();
      await this.dependencies.audit.appendAction(this.record(request, result.success ? "succeeded" : result.cancelled ? "cancelled" : "failed", result.success, result.durationMs, result.success ? "Tool completed successfully." : result.error?.message ?? "Tool failed.", result.affectedPaths, result.exitCode, result.rollback, result.output));
      return result;
    } catch (error) {
      const durationMs = Date.now() - started;
      const cancelled = controller.signal.aborted;
      const message = error instanceof Error ? error.message : String(error);
      const errorCode2 = cancelled ? "CANCELLED" : message.startsWith("SCOPE_FAILURE:") ? "SCOPE_FAILURE" : "EXECUTION_FAILED";
      const result = { requestId: request.id, toolName: request.toolName, success: false, affectedPaths: [], warnings: [], error: { code: errorCode2, message }, durationMs, cancelled };
      request.state = cancelled ? "cancelled" : "failed";
      request.updatedAt = Date.now();
      await this.dependencies.audit.appendAction(this.record(request, cancelled ? "cancelled" : "failed", false, durationMs, result.error.message, []));
      return result;
    } finally {
      this.controllers.delete(request.id);
      this.requestPathPolicies.delete(request.id);
    }
  }
  record(request, executionState, success, executionDurationMs, resultSummary, affectedPaths, exitCode, rollback, output) {
    const auditedOutput = request.toolName === "shell.run" ? boundedShellAuditOutput(output) : void 0;
    return { id: request.id, timestamp: Date.now(), workspaceId: request.workspaceId, conversationId: request.conversationId, modelId: request.modelId, toolName: request.toolName, taskId: request.executionContext.taskId, stepId: request.executionContext.stepId, sanitizedInputs: sanitizeToolData(request.input), executionState, executionDurationMs, success, result: { success, summary: resultSummary, exitCode: exitCode ?? null, affectedPathCount: affectedPaths.length, rollbackAvailable: rollback?.available ?? false, ...auditedOutput === void 0 ? {} : { output: auditedOutput } }, resultSummary, affectedPaths, exitCode, rollback };
  }
  async auditValidationFailure(call, context, error) {
    const summary = error instanceof Error ? error.message : String(error);
    await this.dependencies.audit.appendAction({ id: randomUUID(), timestamp: Date.now(), workspaceId: context.workspaceId, conversationId: context.conversationId, modelId: context.modelId, toolName: call.name, taskId: context.task?.taskId, stepId: context.task?.stepId, sanitizedInputs: sanitizeToolData(call.arguments), executionState: "validation-failed", executionDurationMs: 0, success: false, result: { success: false, summary }, resultSummary: summary, affectedPaths: [] });
  }
  required(id2) {
    const request = this.requests.get(id2);
    if (!request) throw new Error("Unknown tool request.");
    return request;
  }
  availability(name) {
    if (name === "terminal.read" && !this.dependencies.terminal) return { available: false, reason: "the user terminal service is unavailable" };
    if (name.startsWith("github.") && !this.dependencies.github) return { available: false, reason: "GitHub integration is unavailable" };
    if (name.startsWith("task.") && !this.dependencies.tasks) return { available: false, reason: "the persistent task runtime is unavailable" };
    if (name.startsWith("browser.") && !this.dependencies.browser) return { available: false, reason: "the FORGE Browser is unavailable" };
    if (name.startsWith("browser.") && !this.dependencies.browser?.enabled()) return { available: false, reason: "external web research is disabled in Settings" };
    if (name === "browser.savecontext" && !this.dependencies.memories) return { available: false, reason: "durable workspace memory is unavailable" };
    if (name.startsWith("web.") && !this.dependencies.web.isEnabled()) return { available: false, reason: "external web research is disabled in Settings" };
    return { available: true };
  }
  policyFailure(definition2, input, context) {
    if (context.executionMode === "disabled") return "POLICY_FAILURE: Tool execution is disabled in Settings.";
    if (context.executionMode === "controlled" && !["read", "read-network"].includes(definition2.sideEffect)) return "POLICY_FAILURE: Controlled mode permits read-only capabilities. Select Allow All in Settings to authorize mutations, processes, or network writes.";
    const network = context.networkAccess;
    if (definition2.sideEffect === "read-network" || definition2.sideEffect === "write-network") {
      if (definition2.name.startsWith("github.") || ["git.pull", "git.push"].includes(definition2.name)) {
        if (network && !network.git) return "POLICY_FAILURE: Git network access is disabled in Settings.";
      } else if (network && !network.web) return "POLICY_FAILURE: Web network access is disabled in Settings.";
    }
    if (["shell.run", "task.process.start"].includes(definition2.name)) {
      if (definition2.name === "task.process.start" && context.backgroundTasksEnabled === false) return "POLICY_FAILURE: Background task processes are disabled in Settings.";
      const inferred = typeof input.command === "string" ? inferredNetworkProfile(input.command, Array.isArray(input.args) ? input.args : []) : "offline";
      const profile = inferred === "offline" ? input.networkProfile ?? "offline" : inferred;
      if (network && profile === "git" && !network.git) return "POLICY_FAILURE: Git network access is disabled in Settings.";
      if (network && profile === "package-manager" && !network.packageManager) return "POLICY_FAILURE: Package-manager network access is disabled in Settings.";
      if (network && profile === "network" && !network.general) return "POLICY_FAILURE: General network access is disabled in Settings.";
    }
    return void 0;
  }
  async predict(name, input, policy) {
    if (name === "file.create") return { paths: [input.path], diff: unifiedDiff(input.path, "", input.content) };
    if (name === "file.write") {
      const absolute = await resolveScopedPath(policy, input.path);
      const existing = await readText(absolute);
      return { paths: [absolute], diff: unifiedDiff(absolute, existing.content, input.content), target: absolute };
    }
    if (name === "file.patch") {
      const absolute = await resolveScopedPath(policy, input.path);
      const existing = await readText(absolute);
      const after = applyReplacement(existing.content, input.expected, input.replacement, input.replaceAll);
      return { paths: [absolute], diff: unifiedDiff(absolute, existing.content, after), target: absolute };
    }
    if (["file.rename", "file.move"].includes(name)) return { paths: [input.from, input.to] };
    if (name === "directory.create" || name === "file.delete") return { paths: [input.path] };
    if (name === "git.stage" || name === "git.unstage") {
      const status = await this.dependencies.git.status();
      return { paths: input.files, target: `branch ${status.branch}: ${input.files.join(", ")}` };
    }
    if (name === "git.commit") {
      const status = await this.dependencies.git.status();
      const paths = status.files.filter((file) => file.indexStatus !== " " && file.indexStatus !== "?").map((file) => file.path);
      return { paths, target: `branch ${status.branch}: ${paths.join(", ") || "no staged files"}` };
    }
    if (name === "git.pull" || name === "git.push") {
      const status = await this.dependencies.git.status();
      return { paths: status.files.map((file) => file.path), target: `origin / branch ${status.branch}` };
    }
    return { paths: [] };
  }
  installExecutors() {
    const ok = (output, affectedPaths = [], extra = {}) => ({ success: true, output: { success: true, ...output }, affectedPaths, warnings: [], ...extra });
    this.executors.set("task.redirect", async (input) => {
      if (!this.dependencies.tasks) throw new Error("Persistent task runtime is unavailable.");
      const taskService = this.dependencies.tasks;
      return ok({ task: await taskService.redirect(input.taskId, input.instruction) });
    });
    const missing = (requestedPath) => ({ missing: true, requestedPath, recovery: { action: "restart-at-workspace-root", path: ".", nearestRequestedParent: path__default.dirname(requestedPath) || ".", instruction: "List the workspace root, discover the real layout, and retry only with an observed path." } });
    this.executors.set("file.list", async (input, request) => {
      const requestedPath = input.path === "." ? "." : input.path;
      const root = await promises.realpath(this.root(request));
      const absolute = await this.resolvePath(request, requestedPath, true);
      if (!await pathExists(absolute)) return ok({ ...missing(requestedPath), entries: [], truncated: false });
      const entries = [];
      const skipped = [];
      const scanLimit = input.offset + input.maxEntries + 1;
      const visit2 = async (current, depth) => {
        if (entries.length >= scanLimit) return;
        let directory;
        try {
          directory = await promises.readdir(current, { withFileTypes: true });
        } catch (error) {
          if (skippableFileSystemError(error)) {
            if (skipped.length < 100) skipped.push({ path: displayPath(root, current), error: String(error.code) });
            return;
          }
          throw error;
        }
        directory.sort((left, right) => left.name.localeCompare(right.name));
        for (const entry of directory) {
          if (entries.length >= scanLimit) return;
          const child = path__default.join(current, entry.name);
          try {
            const stat = await promises.lstat(child);
            entries.push({ path: displayPath(root, child), type: entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "symlink" : "file", size: stat.size });
            if (input.recursive && entry.isDirectory() && depth < input.maxDepth) await visit2(child, depth + 1);
          } catch (error) {
            if (!skippableFileSystemError(error)) throw error;
            if (skipped.length < 100) skipped.push({ path: displayPath(root, child), error: String(error.code) });
          }
        }
      };
      await visit2(absolute, 0);
      const page = entries.slice(input.offset, input.offset + input.maxEntries);
      const nextOffset = input.offset + page.length;
      const truncated = nextOffset < entries.length;
      return ok({ entries: page, totalEntries: truncated ? void 0 : entries.length, totalEntriesAtLeast: entries.length, skipped, truncated, continuation: truncated ? { offset: nextOffset, instruction: "Call file.list again with the same path, recursion, and depth plus this offset." } : void 0 });
    });
    this.executors.set("file.read", async (input, request) => {
      const absolute = await this.resolvePath(request, input.path, true);
      if (!await pathExists(absolute)) return ok(missing(input.path));
      const stat = await promises.stat(absolute);
      if (!stat.isFile()) return ok({ path: input.path, unreadable: true, reason: "not-a-file", recovery: { action: "list-path", path: input.path, instruction: "Use file.list for directories, then call file.read with an observed file path." } });
      const data = await readText(absolute, MAX_RANGED_TEXT_BYTES);
      const content = data.content;
      const lineStarts = [0];
      for (let index = 0; index < content.length; index += 1) if (content[index] === "\n") lineStarts.push(index + 1);
      const totalLines = lineStarts.length;
      const startOffset = input.offset ?? lineStarts[(input.startLine ?? 1) - 1] ?? content.length;
      const requestedEnd = input.endLine === void 0 ? content.length : lineStarts[input.endLine] ?? content.length;
      const endOffset = Math.max(startOffset, Math.min(content.length, requestedEnd));
      const maxEnd = Math.min(endOffset, startOffset + input.maxCharacters);
      const returned = content.slice(startOffset, maxEnd);
      const lineAt = (offset) => {
        let line = 0;
        for (let index = 1; index < lineStarts.length; index += 1) {
          if (lineStarts[index] > offset) break;
          line = index;
        }
        return line + 1;
      };
      const truncated = maxEnd < endOffset;
      return ok({ path: input.path, content: returned, encoding: data.encoding, totalCharacters: content.length, totalLines, returnedRange: { offset: startOffset, length: returned.length, startLine: lineAt(startOffset), endLine: lineAt(Math.max(startOffset, maxEnd - 1)) }, truncated, continuation: truncated ? { offset: maxEnd, instruction: "Call file.read again with this offset and the same maxCharacters." } : void 0 });
    });
    this.executors.set("file.read.binary", async (input, request) => {
      const absolute = await this.resolvePath(request, input.path);
      const [buffer, stat] = await Promise.all([promises.readFile(absolute), promises.stat(absolute)]);
      if (!stat.isFile()) return ok({ path: input.path, unreadable: true, reason: "not-a-file" });
      if (buffer.byteLength > input.maxBytes) throw new Error(`Binary file exceeds the requested ${input.maxBytes.toLocaleString()} byte limit.`);
      return ok({ path: input.path, encoding: "base64", content: buffer.toString("base64"), byteLength: buffer.byteLength, mode: stat.mode });
    });
    this.executors.set("file.search", async (input, request, signal) => {
      const requestedPath = input.path === "." ? "." : input.path;
      const root = await promises.realpath(this.root(request));
      const absolute = await this.resolvePath(request, requestedPath, true);
      if (!await pathExists(absolute)) return ok({ ...missing(requestedPath), matches: [], truncated: false });
      const matches = [];
      let matchOffset = 0;
      const query = input.caseSensitive ? input.query : input.query.toLowerCase();
      const skipped = [];
      const visit2 = async (current) => {
        if (signal.aborted || matches.length >= input.maxResults) return;
        let directory;
        try {
          directory = await promises.readdir(current, { withFileTypes: true });
        } catch (error) {
          if (skippableFileSystemError(error)) {
            if (skipped.length < 100) skipped.push({ path: displayPath(root, current), error: String(error.code) });
            return;
          }
          throw error;
        }
        for (const entry of directory) {
          if (signal.aborted || matches.length >= input.maxResults) return;
          const child = path__default.join(current, entry.name);
          if (entry.isDirectory()) await visit2(child);
          else if (entry.isFile()) {
            try {
              const data = await readText(child);
              for (const [index, line] of data.content.split(/\r?\n/).entries()) {
                const haystack = input.caseSensitive ? line : line.toLowerCase();
                if (haystack.includes(query)) {
                  if (matchOffset >= input.offset) matches.push({ path: displayPath(root, child), line: index + 1, text: line.slice(0, 2e3) });
                  matchOffset += 1;
                }
                if (matches.length >= input.maxResults) break;
              }
            } catch (error) {
              if (skippableFileSystemError(error) && skipped.length < 100) skipped.push({ path: displayPath(root, child), error: String(error.code) });
            }
          }
        }
      };
      await visit2(absolute);
      const truncated = matches.length >= input.maxResults;
      return ok({ matches, skipped, truncated, totalOrMore: input.offset + matches.length + (truncated ? 1 : 0), continuation: truncated ? { offset: input.offset + matches.length, instruction: "Call file.search again with the same query/path and this offset." } : void 0 });
    });
    this.executors.set("file.create", async (input, request) => {
      this.assertNotDirty(input.path);
      const absolute = await this.resolvePath(request, input.path, true);
      await promises.mkdir(path__default.dirname(absolute), { recursive: true });
      await promises.writeFile(absolute, input.content, { flag: "wx" });
      return ok({ path: absolute }, [absolute], { diff: request.diff, rollback: { available: true, instructions: `Delete ${absolute} to undo this creation.` } });
    });
    for (const name of ["file.write", "file.patch"]) this.executors.set(name, async (input, request) => {
      this.assertNotDirty(input.path);
      const absolute = await this.resolvePath(request, input.path);
      const original = await readText(absolute);
      const after = name === "file.write" ? input.content : applyReplacement(original.content, input.expected, input.replacement, input.replaceAll);
      const backup = await backupPath(this.root(request), absolute);
      await promises.copyFile(absolute, backup);
      await atomicWrite(absolute, after, original.encoding, original.mode);
      return ok({ path: absolute }, [absolute], { diff: unifiedDiff(absolute, original.content, after), rollback: { available: true, backupPath: path__default.relative(this.root(request), backup).replaceAll("\\", "/"), instructions: `Restore the backup over ${absolute}.` } });
    });
    for (const name of ["file.rename", "file.move"]) this.executors.set(name, async (input, request) => {
      this.assertNotDirty(input.from);
      this.assertNotDirty(input.to);
      const source = await this.resolvePath(request, input.from);
      const destination = await this.resolvePath(request, input.to, true);
      await promises.access(destination).then(() => {
        throw new Error("Destination already exists.");
      }).catch((error) => {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
        throw error;
      });
      await promises.mkdir(path__default.dirname(destination), { recursive: true });
      await promises.rename(source, destination);
      return ok({}, [source, destination], { rollback: { available: true, instructions: `Move ${destination} back to ${source}.` } });
    });
    this.executors.set("directory.create", async (input, request) => {
      const absolute = await this.resolvePath(request, input.path, true);
      await promises.mkdir(absolute, { recursive: false });
      return ok({}, [absolute], { rollback: { available: true, instructions: `Remove the empty directory ${absolute}.` } });
    });
    this.executors.set("file.delete", async (input, request) => {
      this.assertNotDirty(input.path);
      const absolute = await this.resolvePath(request, input.path);
      if (inside(absolute, await promises.realpath(this.root(request)))) throw new Error("Deleting the active workspace or one of its parent directories would make the rollback backup recursive. Delete a narrower path.");
      const backup = await backupPath(this.root(request), absolute);
      await promises.cp(absolute, backup, { recursive: true, errorOnExist: true });
      await promises.rm(absolute, { recursive: true, force: false });
      return ok({}, [absolute], { rollback: { available: true, backupPath: path__default.relative(this.root(request), backup).replaceAll("\\", "/"), instructions: `Restore the backup to ${absolute}.` } });
    });
    this.executors.set("terminal.read", async (input) => {
      if (!this.dependencies.terminal) throw new Error("Terminal evidence is unavailable.");
      const sessions = this.dependencies.terminal.list().filter((session) => !input.sessionId || session.id === input.sessionId).map((session) => ({ id: session.id, cwd: session.cwd, state: session.state, exitCode: session.exitCode, recentOutput: session.recentOutput.slice(-(input.maxCharacters ?? 4e3)) }));
      return ok({ sessions });
    });
    this.executors.set("git.status", async () => ok({ status: await this.dependencies.git.status() }));
    this.executors.set("git.diff", async (input) => ok({ diff: await this.dependencies.git.diff(input.staged) }));
    this.executors.set("git.log", async (input) => ok({ commits: await this.dependencies.git.log(input.limit) }));
    this.executors.set("git.branches", async () => ok({ branches: await this.dependencies.git.branches() }));
    this.executors.set("git.stage", async (input) => {
      await this.dependencies.git.stage(input.files);
      return ok({}, input.files);
    });
    this.executors.set("git.unstage", async (input) => {
      await this.dependencies.git.unstage(input.files);
      return ok({}, input.files);
    });
    this.executors.set("git.commit", async (input) => {
      const status = await this.dependencies.git.status();
      const staged = status.files.filter((file) => file.indexStatus !== " " && file.indexStatus !== "?").map((file) => file.path);
      if (!staged.length) throw new Error("No staged files are available to commit.");
      const commit = await this.dependencies.git.commit(input.message);
      return ok({ commit, branch: status.branch, stagedFiles: staged }, staged);
    });
    this.executors.set("git.pull", async () => {
      const status = await this.dependencies.git.status();
      if (status.files.length) throw new Error("Pull is blocked while the working tree is dirty.");
      await this.dependencies.git.pull();
      return ok({ branch: status.branch });
    });
    this.executors.set("git.push", async () => {
      const status = await this.dependencies.git.status();
      await this.dependencies.git.push();
      return ok({ branch: status.branch });
    });
    this.executors.set("shell.run", async (input, request) => {
      const workingDirectory = await this.resolvePath(request, input.workingDirectory ?? ".", false);
      const output = await this.dependencies.shell.run({ ...input, workingDirectory }, request.id, true);
      return { success: output.exitCode === 0 && !output.timedOut && !output.cancelled, output: { success: output.exitCode === 0 && !output.timedOut && !output.cancelled, ...output }, affectedPaths: [], warnings: [], exitCode: output.exitCode, truncated: output.truncated, cancelled: output.cancelled, ...output.exitCode === 0 && !output.timedOut && !output.cancelled ? {} : { error: { code: output.timedOut ? "TIMEOUT" : output.cancelled ? "CANCELLED" : "NONZERO_EXIT", message: `Command exited with code ${output.exitCode ?? "unknown"}.` } } };
    });
    this.executors.set("web.search", async (input) => ok(await this.dependencies.web.search(input.query)));
    this.executors.set("web.fetch", async (input) => ok(await this.dependencies.web.fetch(input.url)));
    this.executors.set("browser.open", async (input) => {
      if (!this.dependencies.browser) throw new Error("The FORGE Browser is unavailable.");
      if (!this.dependencies.browser.enabled()) throw new Error("Agent web research is disabled in Settings. Enable it before asking the agent to use the FORGE Browser.");
      return ok(await this.dependencies.browser.open(input.url));
    });
    this.executors.set("browser.read", async () => {
      if (!this.dependencies.browser) throw new Error("The FORGE Browser is unavailable.");
      if (!this.dependencies.browser.enabled()) throw new Error("Agent web research is disabled in Settings. Enable it before sending browser content to the model.");
      return ok(await this.dependencies.browser.read());
    });
    this.executors.set("browser.find", async (input) => {
      if (!this.dependencies.browser) throw new Error("The FORGE Browser is unavailable.");
      if (!this.dependencies.browser.enabled()) throw new Error("Agent web research is disabled in Settings. Enable it before sending browser content to the model.");
      const page = await this.dependencies.browser.read();
      const needle = input.query.toLocaleLowerCase();
      const matches = [];
      let offset = 0;
      while (matches.length < input.maxResults) {
        const index = page.text.toLocaleLowerCase().indexOf(needle, offset);
        if (index < 0) break;
        matches.push({ index, excerpt: page.text.slice(Math.max(0, index - 180), Math.min(page.text.length, index + needle.length + 420)).replace(/\s+/g, " ").trim() });
        offset = index + Math.max(1, needle.length);
      }
      return ok({ url: page.url, title: page.title, query: input.query, matches, truncated: page.truncated || matches.length >= input.maxResults });
    });
    this.executors.set("browser.savecontext", async (input) => {
      if (!this.dependencies.browser || !this.dependencies.memories) throw new Error("Browser context storage is unavailable.");
      const page = await this.dependencies.browser.read();
      const memory = await this.dependencies.memories.create({ type: "document", title: input.title, content: input.content, metadata: { source: "forge-browser", url: page.url, pageTitle: page.title, savedAt: Date.now() } });
      return ok({ memory: { id: memory.id, title: input.title, url: page.url, pageTitle: page.title, createdAt: memory.createdAt } }, [], { rollback: { available: true, instructions: `Delete durable memory ${memory.id} from Workspace Intelligence to remove this saved browser context.` } });
    });
    this.executors.set("github.read", async (input) => {
      if (!this.dependencies.github) throw new Error("GitHub integration is unavailable.");
      return ok(await this.dependencies.github.read(input.resource, input));
    });
    this.executors.set("github.mutate", async (input) => {
      if (!this.dependencies.github) throw new Error("GitHub integration is unavailable.");
      return ok(await this.dependencies.github.mutate(input.action, input));
    });
    this.executors.set("task.inspect", async (input) => {
      if (!this.dependencies.tasks) throw new Error("Persistent task runtime is unavailable.");
      return ok({ task: await this.dependencies.tasks.get(input.taskId) });
    });
    this.executors.set("task.create", async (input) => {
      if (!this.dependencies.tasks) throw new Error("Persistent task runtime is unavailable.");
      const { reason: _reason, ...draft } = input;
      return ok({ task: await this.dependencies.tasks.create(draft) });
    });
    this.executors.set("task.resume", async (input) => {
      if (!this.dependencies.tasks) throw new Error("Persistent task runtime is unavailable.");
      return ok({ task: await this.dependencies.tasks.resume(input.taskId) });
    });
    this.executors.set("task.pause", async (input) => {
      if (!this.dependencies.tasks) throw new Error("Persistent task runtime is unavailable.");
      return ok({ task: await this.dependencies.tasks.pause(input.taskId, input.reason) });
    });
    this.executors.set("task.cancel", async (input) => {
      if (!this.dependencies.tasks) throw new Error("Persistent task runtime is unavailable.");
      return ok({ task: await this.dependencies.tasks.cancel(input.taskId, input.reason, input.trackingOnly) });
    });
    this.executors.set("task.checkpoint", async (input, request) => {
      if (!this.dependencies.tasks) throw new Error("Persistent task runtime is unavailable.");
      const { taskId, stepId } = request.executionContext;
      if (!taskId || !stepId) throw new Error("task.checkpoint requires an active persistent task step; FORGE supplies its IDs internally.");
      return ok({ task: await this.dependencies.tasks.checkpoint(taskId, { ...input, stepId, auditReference: request.id }) });
    });
    this.executors.set("task.handoff", async (_input, request) => {
      if (!this.dependencies.tasks) throw new Error("Persistent task runtime is unavailable.");
      const taskId = request.executionContext.taskId;
      if (!taskId) throw new Error("task.handoff requires an active persistent task; FORGE supplies its ID internally.");
      const handoff = await this.dependencies.tasks.generateHandoff(taskId);
      return ok({ handoff }, handoff.relativePath ? [handoff.relativePath] : []);
    });
    this.executors.set("task.process.start", async (input, request) => {
      if (!this.dependencies.tasks) throw new Error("Persistent task runtime is unavailable.");
      const { taskId, stepId } = request.executionContext;
      if (!taskId || !stepId) throw new Error("task.process.start requires an active persistent task step; FORGE supplies its IDs internally.");
      const workingDirectory = await this.resolvePath(request, input.workingDirectory ?? ".", false);
      const processInput = { command: input.command, args: input.args, workingDirectory, timeoutMs: input.timeoutMs, environment: input.environment, environmentAllowlist: input.environmentAllowlist, networkProfile: input.networkProfile, reason: input.reason, expectedOutcome: input.expectedOutcome };
      const started = await this.dependencies.tasks.startBackground(taskId, stepId, processInput, request.id);
      return ok({ started }, started.process?.outputPath ? [started.process.outputPath] : []);
    });
  }
  root(request) {
    const root = this.workspaceRoots.get(request.workspaceId);
    if (!root) throw new Error("Workspace root is unavailable for this request.");
    return root;
  }
  resolvePath(request, requestedPath, allowMissing = false) {
    const policy = this.requestPathPolicies.get(request.id) ?? { workspaceRoot: this.root(request), scope: "workspace" };
    return resolveScopedPath(policy, requestedPath, allowMissing);
  }
  assertNotDirty(relative) {
    if (this.dependencies.dirtyPaths().has(relative)) throw new Error(`The editor has unsaved content for ${relative}; save or discard it before tool execution.`);
  }
}
async function pathExists(absolute) {
  try {
    await promises.access(absolute);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}
function applyReplacement(content, expected, replacement, replaceAll) {
  if (!content.includes(expected)) throw new Error("Patch precondition failed: expected text was not found.");
  if (!replaceAll && content.indexOf(expected) !== content.lastIndexOf(expected)) throw new Error("Patch is ambiguous; expected text occurs more than once.");
  return replaceAll ? content.split(expected).join(replacement) : content.replace(expected, replacement);
}
function parseStructuredToolFallback(provider, text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  let value;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const parsed = z.object({ type: z.literal("forge_tool_request"), id: z.string().optional(), tool: z.string(), arguments: z.unknown() }).strict().safeParse(value);
  if (!parsed.success) return null;
  return { id: parsed.data.id ?? randomUUID(), name: parsed.data.tool, arguments: parsed.data.arguments, provider };
}
const SECRET_NAME = /(?:^|_)(?:TOKEN|SECRET|PASSWORD|PASS|KEY|CREDENTIAL|AUTH)(?:_|$)/i;
const SAFE_PARENT_ENV = [
  "PATH",
  "LANG",
  "LC_ALL",
  "TERM",
  "TMPDIR",
  "DISPLAY",
  "XAUTHORITY",
  "XDG_RUNTIME_DIR",
  "DBUS_SESSION_BUS_ADDRESS",
  "XDG_DATA_HOME",
  "XDG_CONFIG_HOME",
  "XDG_CACHE_HOME",
  "XDG_STATE_HOME",
  "XDG_DATA_DIRS",
  "XDG_CONFIG_DIRS",
  "XDG_CURRENT_DESKTOP",
  "XDG_SESSION_TYPE",
  "DESKTOP_SESSION",
  "FORGE_OS_SESSION",
  "FORGE_SHELL_MODE",
  "FORGE_OS_VERSION",
  "BROWSER",
  "SystemRoot",
  "ComSpec",
  "PATHEXT",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "PROGRAMDATA",
  "TEMP",
  "TMP",
  "WINDIR"
];
function validSessionVariable(name, value) {
  if (value.includes("\0") || value.includes("\n") || value.includes("\r")) return false;
  if (name === "DISPLAY") return /^:[0-9]+(?:\.[0-9]+)?$/.test(value) || /^[A-Za-z0-9_.-]+:[0-9]+(?:\.[0-9]+)?$/.test(value);
  if (name === "DBUS_SESSION_BUS_ADDRESS") return /^(?:unix:(?:path|abstract)=|autolaunch:)/.test(value);
  if (name === "XDG_RUNTIME_DIR" || name === "XAUTHORITY") return path__default.isAbsolute(value);
  return true;
}
const NETWORK_COMMANDS = /* @__PURE__ */ new Map([
  ["curl", "network"],
  ["wget", "network"],
  ["ssh", "network"],
  ["scp", "network"],
  ["npm", "package-manager"],
  ["npx", "package-manager"],
  ["pnpm", "package-manager"],
  ["yarn", "package-manager"],
  ["bun", "package-manager"],
  ["git", "git"]
]);
function assertNetworkProfile(input) {
  const executable = path__default.basename(input.command).toLowerCase();
  let required2 = NETWORK_COMMANDS.get(executable);
  const primaryArgument = input.args.find((argument) => !argument.startsWith("-"))?.toLowerCase();
  if (executable === "git" && !["clone", "fetch", "pull", "push", "ls-remote"].includes(primaryArgument ?? "")) required2 = void 0;
  if (["npm", "pnpm", "yarn", "bun"].includes(executable) && !["install", "ci", "add", "update", "publish", "dlx", "create"].includes(primaryArgument ?? "")) required2 = void 0;
  const profile = input.networkProfile ?? "offline";
  if (required2 && profile === "offline") throw new Error(`${executable} requires an explicit ${required2} network profile; offline commands may not use a known network-capable executable.`);
  if (required2 === "package-manager" && !["package-manager", "network"].includes(profile)) throw new Error(`${executable} requires the package-manager or network profile.`);
  if (required2 === "git" && !["git", "network"].includes(profile)) throw new Error("git requires the git or network profile.");
}
async function resolveWorkspacePath(workspaceRoot, requested) {
  const selected = requested?.trim() || ".";
  if (selected.includes("\0")) throw new Error("Working directory may not contain null bytes.");
  let root;
  try {
    root = await promises.realpath(workspaceRoot);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") throw new Error(`Workspace root does not exist: ${workspaceRoot}`);
    throw error;
  }
  const expanded = selected === "~" ? os.homedir() : selected.startsWith(`~${path__default.sep}`) ? path__default.join(os.homedir(), selected.slice(2)) : selected;
  const candidate = path__default.resolve(root, expanded);
  let resolved;
  try {
    resolved = await promises.realpath(candidate);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") throw new Error(`cwd does not exist: ${selected}`);
    throw error;
  }
  const stat = await promises.stat(resolved);
  if (!stat.isDirectory()) throw new Error("Working directory must be a directory.");
  return resolved;
}
async function resolveAuthorizedWorkingDirectory(workspaceRoot, requested) {
  const selected = requested?.trim() || workspaceRoot;
  if (selected.includes("\0")) throw new Error("Working directory may not contain null bytes.");
  const expanded = selected === "~" ? os.homedir() : selected.startsWith("~/") || selected.startsWith(`~${path__default.sep}`) ? path__default.join(os.homedir(), selected.slice(2)) : selected;
  let resolved;
  try {
    resolved = await promises.realpath(path__default.resolve(workspaceRoot, expanded));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") throw new Error(`cwd does not exist: ${selected}`);
    throw error;
  }
  if (!(await promises.stat(resolved)).isDirectory()) throw new Error("Working directory must be a directory.");
  return resolved;
}
function assertCanonicalExecutable(command, args) {
  if (!command.trim() || command.includes("\0")) throw new Error("A valid executable is required.");
  if (/\s/.test(command) && !path__default.isAbsolute(command)) throw new Error('Executable and arguments must be separate before execution; for example use command "hermes" with args ["acp", "--help"], or command "bash" with args ["-lc", "<script>"] for shell syntax.');
  if (args.some((argument) => argument.includes("\0"))) throw new Error("Shell arguments may not contain null bytes.");
}
function filteredEnvironment(requested = {}, allowlist = []) {
  const allowed = new Set(allowlist);
  const environment = {};
  for (const name of SAFE_PARENT_ENV) {
    const value = process.env[name];
    if (value && validSessionVariable(name, value)) environment[name] = value;
  }
  for (const [name, value] of Object.entries(requested)) {
    if (!allowed.has(name)) continue;
    if (SECRET_NAME.test(name)) throw new Error(`Secret-like environment variable is blocked: ${name}`);
    environment[name] = value;
  }
  return environment;
}
function terminalEnvironment(shell2) {
  const home = os.homedir();
  const username = os.userInfo().username;
  const userPrefix = path__default.join(home, ".local");
  const inherited = filteredEnvironment();
  const pathEntries = [
    path__default.join(userPrefix, "bin"),
    path__default.join(home, ".opencode", "bin"),
    ...process.platform === "win32" ? [] : ["/opt/homebrew/bin", "/opt/homebrew/sbin", "/usr/local/bin"],
    ...(inherited.PATH ?? "").split(path__default.delimiter)
  ].filter(Boolean);
  return {
    ...inherited,
    HOME: home,
    USER: username,
    LOGNAME: username,
    SHELL: shell2,
    TERM: inherited.TERM ?? "xterm-256color",
    COLORTERM: "truecolor",
    TERM_PROGRAM: "FORGE",
    NPM_CONFIG_PREFIX: userPrefix,
    PATH: [...new Set(pathEntries)].join(path__default.delimiter)
  };
}
function defaultTerminalShell(environment = process.env) {
  const configuredShell = environment.SHELL;
  if (configuredShell && path__default.isAbsolute(configuredShell)) return configuredShell;
  if (process.platform === "win32") return environment.COMSPEC || "cmd.exe";
  return "/bin/bash";
}
function terminalSpawnArguments() {
  return process.platform === "win32" ? [] : ["-l"];
}
class ShellService {
  constructor(workspaceRoot, outputLimit = 1e6) {
    this.workspaceRoot = workspaceRoot;
    this.outputLimit = outputLimit;
  }
  running = /* @__PURE__ */ new Map();
  async run(input, requestId = randomUUID(), allowAuthorizedExternalCwd = false) {
    const root = this.workspaceRoot();
    if (!root) throw new Error("Open a workspace before running a shell tool.");
    assertCanonicalExecutable(input.command, input.args);
    assertNetworkProfile(input);
    const cwd = allowAuthorizedExternalCwd ? await resolveAuthorizedWorkingDirectory(root, input.workingDirectory) : await resolveWorkspacePath(root, input.workingDirectory);
    const timeoutMs = Math.min(Math.max(input.timeoutMs, 100), 10 * 6e4);
    const environment = filteredEnvironment(input.environment, input.environmentAllowlist);
    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let truncated = false;
      let timedOut = false;
      let cancelled = false;
      let settled = false;
      const child = spawn(input.command, input.args, { cwd, env: environment, shell: false, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
      this.running.set(requestId, child);
      const append = (current, chunk) => {
        if (current.length >= this.outputLimit) {
          truncated = true;
          return current;
        }
        const next = current + chunk.toString("utf8");
        if (next.length > this.outputLimit) {
          truncated = true;
          return next.slice(0, this.outputLimit);
        }
        return next;
      };
      child.stdout?.on("data", (chunk) => {
        stdout = append(stdout, chunk);
      });
      child.stderr?.on("data", (chunk) => {
        stderr = append(stderr, chunk);
      });
      const stopTree = () => {
        if (!child.pid) return;
        try {
          if (process.platform === "win32") child.kill("SIGTERM");
          else process.kill(-child.pid, "SIGTERM");
        } catch {
          child.kill("SIGTERM");
        }
      };
      const timer = setTimeout(() => {
        timedOut = true;
        stopTree();
      }, timeoutMs);
      child.once("error", (error) => {
        clearTimeout(timer);
        this.running.delete(requestId);
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
      child.once("close", (code, signal) => {
        clearTimeout(timer);
        this.running.delete(requestId);
        cancelled = cancelled || this.cancelled.has(requestId);
        this.cancelled.delete(requestId);
        if (!settled) {
          settled = true;
          resolve({ executable: input.command, argv: [...input.args], cwd, stdout, stderr, exitCode: code, signal, timedOut, cancelled, truncated });
        }
      });
    });
  }
  async startBackground(input, outputPath, requestId = randomUUID(), allowAuthorizedExternalCwd = false) {
    const root = this.workspaceRoot();
    if (!root) throw new Error("Open a workspace before running a background shell task.");
    assertCanonicalExecutable(input.command, input.args);
    assertNetworkProfile(input);
    if (!outputPath || path__default.isAbsolute(outputPath) || outputPath.split(/[\\/]/).includes("..")) throw new Error("Background output path must be workspace-relative.");
    const cwd = allowAuthorizedExternalCwd ? await resolveAuthorizedWorkingDirectory(root, input.workingDirectory) : await resolveWorkspacePath(root, input.workingDirectory);
    const realRoot = await promises.realpath(root);
    const requestedOutput = path__default.resolve(root, outputPath);
    if (requestedOutput === path__default.resolve(root) || !requestedOutput.startsWith(`${path__default.resolve(root)}${path__default.sep}`)) throw new Error("Background output path escapes the active workspace.");
    await promises.mkdir(path__default.dirname(requestedOutput), { recursive: true });
    const realParent = await promises.realpath(path__default.dirname(requestedOutput));
    if (realParent !== realRoot && !realParent.startsWith(`${realRoot}${path__default.sep}`)) throw new Error("Background output path resolves outside the active workspace.");
    const absoluteOutput = path__default.join(realParent, path__default.basename(requestedOutput));
    const output = await promises.open(absoluteOutput, "a");
    const environment = filteredEnvironment(input.environment, input.environmentAllowlist);
    const startedAt = Date.now();
    return new Promise((resolve, reject) => {
      const child = spawn(input.command, input.args, { cwd, env: environment, shell: false, detached: true, stdio: ["ignore", output.fd, output.fd] });
      const cleanupError = (error) => {
        this.running.delete(requestId);
        void output.close();
        reject(error);
      };
      child.once("error", cleanupError);
      child.once("spawn", () => {
        child.removeListener("error", cleanupError);
        this.running.set(requestId, child);
        child.unref();
        void output.close();
        const timeoutMs = Math.min(Math.max(input.timeoutMs, 100), 24 * 60 * 6e4);
        const timer = setTimeout(() => {
          const running = this.running.get(requestId);
          if (!running?.pid) return;
          try {
            if (process.platform === "win32") running.kill("SIGTERM");
            else process.kill(-running.pid, "SIGTERM");
          } catch {
            running.kill("SIGTERM");
          }
        }, timeoutMs);
        timer.unref();
        child.once("close", () => {
          clearTimeout(timer);
          this.running.delete(requestId);
        });
        resolve({ requestId, pid: child.pid, outputPath, startedAt });
      });
    });
  }
  cancelled = /* @__PURE__ */ new Set();
  cancel(requestId) {
    const child = this.running.get(requestId);
    if (!child?.pid) return false;
    this.cancelled.add(requestId);
    try {
      if (process.platform === "win32") child.kill("SIGTERM");
      else process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
    return true;
  }
}
class TerminalService {
  constructor(workspaceRoot, publish, outputLimit = 12e4) {
    this.workspaceRoot = workspaceRoot;
    this.publish = publish;
    this.outputLimit = outputLimit;
  }
  sessions = /* @__PURE__ */ new Map();
  async create(requestedCwd = ".", columns = 100, rows = 30, requestedId) {
    const root = this.workspaceRoot();
    if (!root) throw new Error("Open a workspace before creating a terminal.");
    const cwd = await resolveWorkspacePath(root, requestedCwd);
    const id2 = requestedId ?? randomUUID();
    if (this.sessions.has(id2)) throw new Error("Terminal session already exists.");
    const shell2 = defaultTerminalShell();
    const terminal = pty.spawn(shell2, terminalSpawnArguments(), { name: "xterm-256color", cols: Math.max(20, columns), rows: Math.max(5, rows), cwd, env: terminalEnvironment(shell2) });
    const info = { id: id2, cwd, pid: terminal.pid, state: "running", exitCode: null, createdAt: Date.now(), title: path__default.basename(cwd), recentOutput: "" };
    const session = { info, process: terminal, workspaceRoot: root };
    this.sessions.set(id2, session);
    terminal.onData((data) => {
      if (this.sessions.get(id2)?.process !== terminal) return;
      info.recentOutput = `${info.recentOutput}${data}`.slice(-this.outputLimit);
      this.publish({ sessionId: id2, type: "output", data });
    });
    terminal.onExit(({ exitCode }) => {
      if (this.sessions.get(id2)?.process !== terminal) return;
      info.state = "exited";
      info.exitCode = exitCode;
      this.publish({ sessionId: id2, type: "exit", exitCode });
    });
    return { ...info };
  }
  list() {
    return [...this.sessions.values()].map(({ info }) => ({ ...info }));
  }
  input(id2, data) {
    const session = this.required(id2);
    if (session.info.state !== "running") throw new Error("Terminal session is not running.");
    if (!data || data.length > 65536 || data.includes("\0")) throw new Error("Terminal input must contain between 1 and 65,536 non-null characters.");
    session.process.write(data);
  }
  resize(id2, columns, rows) {
    this.required(id2).process.resize(Math.max(20, columns), Math.max(5, rows));
  }
  terminate(id2) {
    const session = this.required(id2);
    if (session.info.state === "running") session.process.kill();
  }
  async restart(id2) {
    const current = this.required(id2);
    const { cols, rows } = current.process;
    this.sessions.delete(id2);
    if (current.info.state === "running") current.process.kill();
    return this.create(current.info.cwd, cols, rows, id2);
  }
  remove(id2) {
    this.terminate(id2);
    this.sessions.delete(id2);
  }
  dispose() {
    for (const id2 of [...this.sessions.keys()]) this.remove(id2);
  }
  required(id2) {
    const session = this.sessions.get(id2);
    if (!session) throw new Error("Unknown terminal session.");
    if (this.workspaceRoot() !== session.workspaceRoot) throw new Error("Terminal session does not belong to the active workspace.");
    return session;
  }
}
function privateAddress(address) {
  if (address === "::1" || address === "::" || /^fe[89ab][0-9a-f]:/i.test(address) || /^f[cd][0-9a-f]{2}:/i.test(address)) return true;
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(address);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a >= 224;
}
async function validateExternalUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("A valid external URL is required.");
  }
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Only HTTP and HTTPS URLs are allowed.");
  if (url.username || url.password) throw new Error("Credentials in URLs are forbidden.");
  const hostname2 = url.hostname.toLowerCase();
  if (hostname2 === "localhost" || hostname2.endsWith(".localhost") || hostname2.endsWith(".local")) throw new Error("Local-network URLs are blocked.");
  if (isIP(hostname2) && privateAddress(hostname2)) throw new Error("Private and local network addresses are blocked.");
  const addresses = await lookup$1(hostname2, { all: true });
  if (!addresses.length || addresses.some(({ address }) => privateAddress(address))) throw new Error("The URL resolves to a private or unsafe network address.");
  return url;
}
class WebService {
  constructor(enabled, maxBytes = 2e6) {
    this.enabled = enabled;
    this.maxBytes = maxBytes;
  }
  dispatcher = new Agent$1({ connect: { lookup: (hostname2, options, callback) => {
    const complete = callback;
    lookup(hostname2, { family: options.family, hints: options.hints, all: true, verbatim: true }, (error, addresses) => {
      if (error) {
        complete(error, []);
        return;
      }
      const publicAddresses = addresses.filter((candidate) => !privateAddress(candidate.address));
      const address = publicAddresses.find((candidate) => candidate.family === 4) ?? publicAddresses[0];
      if (!address) {
        complete(Object.assign(new Error("Connection to a private or local network address was blocked."), { code: "FORGE_PRIVATE_ADDRESS" }), []);
        return;
      }
      complete(null, [address]);
    });
  } } });
  isEnabled() {
    return this.enabled();
  }
  async fetch(urlValue, timeoutMs = 2e4) {
    if (!this.enabled()) throw new Error("External web research is disabled in Settings.");
    let url = await validateExternalUrl(urlValue);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(Math.max(timeoutMs, 500), 6e4));
    try {
      for (let redirects = 0; redirects <= 4; redirects += 1) {
        const response = await fetch$1(url, { dispatcher: this.dispatcher, signal: controller.signal, redirect: "manual", headers: { Accept: "text/html,text/plain,application/json;q=0.9", "User-Agent": "FORGE/1.1 external-research" } });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location) throw new Error("External server returned an invalid redirect.");
          url = await validateExternalUrl(new URL(location, url).toString());
          continue;
        }
        const contentType = response.headers.get("content-type") ?? "application/octet-stream";
        if (!/(?:text\/|application\/(?:json|xml|xhtml\+xml))/i.test(contentType)) throw new Error(`Unsupported external content type: ${contentType}`);
        const buffer = new Uint8Array(await response.arrayBuffer());
        const truncated = buffer.byteLength > this.maxBytes;
        const body = new TextDecoder().decode(buffer.slice(0, this.maxBytes));
        const citations = [...body.matchAll(/<a\s+[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>(.*?)<\/a>/gi)].slice(0, 30).map((match) => ({ url: match[1], title: match[2].replace(/<[^>]+>/g, "").trim() || match[1] }));
        return { url: url.toString(), status: response.status, contentType, body, truncated, citations };
      }
      throw new Error("Too many external redirects.");
    } finally {
      clearTimeout(timer);
    }
  }
  async search(query, timeoutMs = 2e4) {
    const normalized = query.trim();
    if (!normalized) throw new Error("A search query is required.");
    if (normalized.length > 1e3) throw new Error("Search query is too long.");
    const response = await this.fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(normalized)}`, timeoutMs);
    const results = [...response.body.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>(.*?)<\/a>/gi)].slice(0, 10).map((match) => ({
      title: match[2].replace(/<[^>]+>/g, "").trim(),
      url: match[1],
      excerpt: match[3].replace(/<[^>]+>/g, "").trim(),
      sourceType: "external-web",
      fetchedAt: Date.now()
    }));
    return { query: normalized, results };
  }
}
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 5500;
const ignoredDirectories = /* @__PURE__ */ new Set([".git", "node_modules", "dist", "build", "out", ".next", ".cache", ".forge", "coverage", "vendor"]);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};
function isIgnoredPath(relativePath2) {
  return relativePath2.replaceAll("\\", "/").split("/").some((part) => ignoredDirectories.has(part));
}
function isLoopbackUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return false;
    const hostname2 = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return hostname2 === "localhost" || hostname2 === "::1" || isIP(hostname2) === 4 && hostname2 === "127.0.0.1";
  } catch {
    return false;
  }
}
async function allocateLoopbackPort(host = DEFAULT_HOST, start = DEFAULT_PORT, end = 5599) {
  for (let port = start; port <= end; port += 1) {
    const candidate = createServer();
    try {
      await new Promise((resolve, reject) => {
        candidate.once("error", reject);
        candidate.listen(port, host, () => resolve());
      });
      await new Promise((resolve) => candidate.close(() => resolve()));
      return port;
    } catch {
      candidate.close();
    }
  }
  throw Object.assign(new Error(`No loopback port is available in the range ${start}-${end}.`), { code: "FORGE_LIVE_PORTS_EXHAUSTED" });
}
function errorCode(error) {
  return error && typeof error === "object" && "code" in error ? String(error.code) : "FORGE_LIVE_ERROR";
}
function safeMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function reloadClient() {
  return `<script>(function(){try{var e=new EventSource('/__forge_live');e.onmessage=function(m){if(m.data==='reload')location.reload()};e.onerror=function(){e.close();setTimeout(arguments.callee,1000)}}catch(_){}})();<\/script>`;
}
function injectReloadClient(html) {
  const client = reloadClient();
  const closingBody = html.search(/<\/body\s*>/i);
  return closingBody < 0 ? `${html}
${client}` : `${html.slice(0, closingBody)}${client}${html.slice(closingBody)}`;
}
class ForgeLiveService {
  constructor(rootPath, options = {}) {
    this.rootPath = rootPath;
    this.rootPath = path.resolve(rootPath);
    this.realRoot = this.rootPath;
    this.preferredPort = options.preferredPort ?? DEFAULT_PORT;
    this.portEnd = options.portEnd ?? 5599;
    this.debounceMs = options.debounceMs ?? 150;
    this.options = options;
    this.current = { workspaceId: this.rootPath, status: "stopped", mode: "static" };
  }
  server = null;
  watcher = null;
  poller = null;
  clients = /* @__PURE__ */ new Set();
  timer = null;
  current;
  startPromise = null;
  realRoot;
  preferredPort;
  portEnd;
  debounceMs;
  options;
  status() {
    return { ...this.current, error: this.current.error ? { ...this.current.error } : void 0 };
  }
  async start() {
    if (this.current.status === "running") return this.status();
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.startInternal().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }
  async startInternal() {
    this.set({ ...this.current, status: "starting", error: void 0 });
    try {
      const stat = await promises.stat(this.rootPath);
      if (!stat.isDirectory()) throw new Error("The FORGE Live workspace must be a directory.");
      this.realRoot = await promises.realpath(this.rootPath);
      const port = await allocateLoopbackPort(DEFAULT_HOST, this.preferredPort, this.portEnd);
      this.server = createServer((request, response) => {
        void this.handle(request, response);
      });
      await new Promise((resolve, reject) => {
        this.server.once("error", reject);
        this.server.listen(port, DEFAULT_HOST, () => resolve());
      });
      this.watchFiles();
      this.set({ workspaceId: this.rootPath, status: "running", mode: "static", host: DEFAULT_HOST, port, url: `http://${DEFAULT_HOST}:${port}`, startedAt: Date.now() });
      return this.status();
    } catch (error) {
      await this.cleanup();
      const failure = { workspaceId: this.rootPath, status: "error", mode: "static", error: { code: errorCode(error), message: safeMessage(error) } };
      this.set(failure);
      throw error;
    }
  }
  async stop() {
    if (this.current.status === "stopped") return this.status();
    this.set({ ...this.current, status: "stopping" });
    await this.cleanup();
    this.set({ workspaceId: this.rootPath, status: "stopped", mode: "static" });
    return this.status();
  }
  async restart() {
    await this.stop();
    return this.start();
  }
  async cleanup() {
    this.watcher?.close();
    this.watcher = null;
    if (this.poller) clearInterval(this.poller);
    this.poller = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const client of this.clients) client.end();
    this.clients.clear();
    if (this.server) await new Promise((resolve) => this.server.close(() => resolve()));
    this.server = null;
  }
  set(next) {
    this.current = next;
    this.options.onState?.(this.status());
  }
  watchFiles() {
    const notify = () => {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = null;
        for (const client of this.clients) client.write("data: reload\\n\\n");
        this.options.onReload?.();
      }, this.debounceMs);
    };
    try {
      this.watcher = watch(this.rootPath, { recursive: true }, (_event, filename) => {
        if (filename && !isIgnoredPath(filename.toString())) notify();
      });
      this.watcher.on("error", () => void 0);
    } catch {
      this.poller = setInterval(notify, Math.max(500, this.debounceMs * 4));
    }
  }
  async handle(request, response) {
    if (request.url === "/__forge_live") {
      response.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive", "Access-Control-Allow-Origin": "null" });
      response.write(": connected\\n\\n");
      this.clients.add(response);
      request.once("close", () => this.clients.delete(response));
      return;
    }
    let requested;
    try {
      requested = decodeURIComponent((request.url ?? "/").split("?")[0]);
    } catch {
      response.writeHead(400);
      response.end("Bad request");
      return;
    }
    if (!requested.startsWith("/")) requested = `/${requested}`;
    const relative = requested === "/" ? "index.html" : requested.replace(/^\/+/, "");
    if (isIgnoredPath(relative) || relative.replaceAll("\\", "/").split("/").includes("..")) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    const candidate = path.resolve(this.rootPath, relative);
    if (candidate !== this.rootPath && !candidate.startsWith(`${this.rootPath}${path.sep}`)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    try {
      let filePath2 = candidate;
      let stat = await promises.stat(filePath2);
      const resolvedCandidate = await promises.realpath(filePath2);
      if (resolvedCandidate !== this.realRoot && !resolvedCandidate.startsWith(`${this.realRoot}${path.sep}`)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      if (stat.isDirectory()) {
        filePath2 = path.join(filePath2, "index.html");
        stat = await promises.stat(filePath2);
      }
      if (!stat.isFile()) throw new Error("not file");
      const extension = path.extname(filePath2).toLowerCase();
      const body = await promises.readFile(filePath2);
      const output = extension === ".html" || extension === ".htm" ? injectReloadClient(body.toString("utf8")) : body;
      response.writeHead(200, { "Content-Type": mimeTypes[extension] ?? "application/octet-stream", "Content-Length": Buffer.byteLength(output) });
      response.end(output);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EACCES") {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      const fallback = `<!doctype html><meta charset="utf-8"><title>FORGE Live</title><h1>No index.html found</h1><p>Create an index.html in this workspace to preview it with FORGE Live.</p>`;
      if (relative === "index.html") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": Buffer.byteLength(fallback) });
        response.end(fallback);
      } else {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
      }
    }
  }
}
var semver = { exports: {} };
var hasRequiredSemver;
function requireSemver() {
  if (hasRequiredSemver) return semver.exports;
  hasRequiredSemver = 1;
  (function(module, exports) {
    exports = module.exports = SemVer;
    var debug;
    if (typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG)) {
      debug = function() {
        var args = Array.prototype.slice.call(arguments, 0);
        args.unshift("SEMVER");
        console.log.apply(console, args);
      };
    } else {
      debug = function() {
      };
    }
    exports.SEMVER_SPEC_VERSION = "2.0.0";
    var MAX_LENGTH = 256;
    var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
    9007199254740991;
    var MAX_SAFE_COMPONENT_LENGTH = 16;
    var MAX_SAFE_BUILD_LENGTH = MAX_LENGTH - 6;
    var re2 = exports.re = [];
    var safeRe = exports.safeRe = [];
    var src = exports.src = [];
    var t = exports.tokens = {};
    var R = 0;
    function tok(n) {
      t[n] = R++;
    }
    var LETTERDASHNUMBER = "[a-zA-Z0-9-]";
    var safeRegexReplacements = [
      ["\\s", 1],
      ["\\d", MAX_LENGTH],
      [LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
    ];
    function makeSafeRe(value) {
      for (var i2 = 0; i2 < safeRegexReplacements.length; i2++) {
        var token = safeRegexReplacements[i2][0];
        var max = safeRegexReplacements[i2][1];
        value = value.split(token + "*").join(token + "{0," + max + "}").split(token + "+").join(token + "{1," + max + "}");
      }
      return value;
    }
    tok("NUMERICIDENTIFIER");
    src[t.NUMERICIDENTIFIER] = "0|[1-9]\\d*";
    tok("NUMERICIDENTIFIERLOOSE");
    src[t.NUMERICIDENTIFIERLOOSE] = "\\d+";
    tok("NONNUMERICIDENTIFIER");
    src[t.NONNUMERICIDENTIFIER] = "\\d*[a-zA-Z-]" + LETTERDASHNUMBER + "*";
    tok("MAINVERSION");
    src[t.MAINVERSION] = "(" + src[t.NUMERICIDENTIFIER] + ")\\.(" + src[t.NUMERICIDENTIFIER] + ")\\.(" + src[t.NUMERICIDENTIFIER] + ")";
    tok("MAINVERSIONLOOSE");
    src[t.MAINVERSIONLOOSE] = "(" + src[t.NUMERICIDENTIFIERLOOSE] + ")\\.(" + src[t.NUMERICIDENTIFIERLOOSE] + ")\\.(" + src[t.NUMERICIDENTIFIERLOOSE] + ")";
    tok("PRERELEASEIDENTIFIER");
    src[t.PRERELEASEIDENTIFIER] = "(?:" + src[t.NUMERICIDENTIFIER] + "|" + src[t.NONNUMERICIDENTIFIER] + ")";
    tok("PRERELEASEIDENTIFIERLOOSE");
    src[t.PRERELEASEIDENTIFIERLOOSE] = "(?:" + src[t.NUMERICIDENTIFIERLOOSE] + "|" + src[t.NONNUMERICIDENTIFIER] + ")";
    tok("PRERELEASE");
    src[t.PRERELEASE] = "(?:-(" + src[t.PRERELEASEIDENTIFIER] + "(?:\\." + src[t.PRERELEASEIDENTIFIER] + ")*))";
    tok("PRERELEASELOOSE");
    src[t.PRERELEASELOOSE] = "(?:-?(" + src[t.PRERELEASEIDENTIFIERLOOSE] + "(?:\\." + src[t.PRERELEASEIDENTIFIERLOOSE] + ")*))";
    tok("BUILDIDENTIFIER");
    src[t.BUILDIDENTIFIER] = LETTERDASHNUMBER + "+";
    tok("BUILD");
    src[t.BUILD] = "(?:\\+(" + src[t.BUILDIDENTIFIER] + "(?:\\." + src[t.BUILDIDENTIFIER] + ")*))";
    tok("FULL");
    tok("FULLPLAIN");
    src[t.FULLPLAIN] = "v?" + src[t.MAINVERSION] + src[t.PRERELEASE] + "?" + src[t.BUILD] + "?";
    src[t.FULL] = "^" + src[t.FULLPLAIN] + "$";
    tok("LOOSEPLAIN");
    src[t.LOOSEPLAIN] = "[v=\\s]*" + src[t.MAINVERSIONLOOSE] + src[t.PRERELEASELOOSE] + "?" + src[t.BUILD] + "?";
    tok("LOOSE");
    src[t.LOOSE] = "^" + src[t.LOOSEPLAIN] + "$";
    tok("GTLT");
    src[t.GTLT] = "((?:<|>)?=?)";
    tok("XRANGEIDENTIFIERLOOSE");
    src[t.XRANGEIDENTIFIERLOOSE] = src[t.NUMERICIDENTIFIERLOOSE] + "|x|X|\\*";
    tok("XRANGEIDENTIFIER");
    src[t.XRANGEIDENTIFIER] = src[t.NUMERICIDENTIFIER] + "|x|X|\\*";
    tok("XRANGEPLAIN");
    src[t.XRANGEPLAIN] = "[v=\\s]*(" + src[t.XRANGEIDENTIFIER] + ")(?:\\.(" + src[t.XRANGEIDENTIFIER] + ")(?:\\.(" + src[t.XRANGEIDENTIFIER] + ")(?:" + src[t.PRERELEASE] + ")?" + src[t.BUILD] + "?)?)?";
    tok("XRANGEPLAINLOOSE");
    src[t.XRANGEPLAINLOOSE] = "[v=\\s]*(" + src[t.XRANGEIDENTIFIERLOOSE] + ")(?:\\.(" + src[t.XRANGEIDENTIFIERLOOSE] + ")(?:\\.(" + src[t.XRANGEIDENTIFIERLOOSE] + ")(?:" + src[t.PRERELEASELOOSE] + ")?" + src[t.BUILD] + "?)?)?";
    tok("XRANGE");
    src[t.XRANGE] = "^" + src[t.GTLT] + "\\s*" + src[t.XRANGEPLAIN] + "$";
    tok("XRANGELOOSE");
    src[t.XRANGELOOSE] = "^" + src[t.GTLT] + "\\s*" + src[t.XRANGEPLAINLOOSE] + "$";
    tok("COERCE");
    src[t.COERCE] = "(^|[^\\d])(\\d{1," + MAX_SAFE_COMPONENT_LENGTH + "})(?:\\.(\\d{1," + MAX_SAFE_COMPONENT_LENGTH + "}))?(?:\\.(\\d{1," + MAX_SAFE_COMPONENT_LENGTH + "}))?(?:$|[^\\d])";
    tok("COERCERTL");
    re2[t.COERCERTL] = new RegExp(src[t.COERCE], "g");
    safeRe[t.COERCERTL] = new RegExp(makeSafeRe(src[t.COERCE]), "g");
    tok("LONETILDE");
    src[t.LONETILDE] = "(?:~>?)";
    tok("TILDETRIM");
    src[t.TILDETRIM] = "(\\s*)" + src[t.LONETILDE] + "\\s+";
    re2[t.TILDETRIM] = new RegExp(src[t.TILDETRIM], "g");
    safeRe[t.TILDETRIM] = new RegExp(makeSafeRe(src[t.TILDETRIM]), "g");
    var tildeTrimReplace = "$1~";
    tok("TILDE");
    src[t.TILDE] = "^" + src[t.LONETILDE] + src[t.XRANGEPLAIN] + "$";
    tok("TILDELOOSE");
    src[t.TILDELOOSE] = "^" + src[t.LONETILDE] + src[t.XRANGEPLAINLOOSE] + "$";
    tok("LONECARET");
    src[t.LONECARET] = "(?:\\^)";
    tok("CARETTRIM");
    src[t.CARETTRIM] = "(\\s*)" + src[t.LONECARET] + "\\s+";
    re2[t.CARETTRIM] = new RegExp(src[t.CARETTRIM], "g");
    safeRe[t.CARETTRIM] = new RegExp(makeSafeRe(src[t.CARETTRIM]), "g");
    var caretTrimReplace = "$1^";
    tok("CARET");
    src[t.CARET] = "^" + src[t.LONECARET] + src[t.XRANGEPLAIN] + "$";
    tok("CARETLOOSE");
    src[t.CARETLOOSE] = "^" + src[t.LONECARET] + src[t.XRANGEPLAINLOOSE] + "$";
    tok("COMPARATORLOOSE");
    src[t.COMPARATORLOOSE] = "^" + src[t.GTLT] + "\\s*(" + src[t.LOOSEPLAIN] + ")$|^$";
    tok("COMPARATOR");
    src[t.COMPARATOR] = "^" + src[t.GTLT] + "\\s*(" + src[t.FULLPLAIN] + ")$|^$";
    tok("COMPARATORTRIM");
    src[t.COMPARATORTRIM] = "(\\s*)" + src[t.GTLT] + "\\s*(" + src[t.LOOSEPLAIN] + "|" + src[t.XRANGEPLAIN] + ")";
    re2[t.COMPARATORTRIM] = new RegExp(src[t.COMPARATORTRIM], "g");
    safeRe[t.COMPARATORTRIM] = new RegExp(makeSafeRe(src[t.COMPARATORTRIM]), "g");
    var comparatorTrimReplace = "$1$2$3";
    tok("HYPHENRANGE");
    src[t.HYPHENRANGE] = "^\\s*(" + src[t.XRANGEPLAIN] + ")\\s+-\\s+(" + src[t.XRANGEPLAIN] + ")\\s*$";
    tok("HYPHENRANGELOOSE");
    src[t.HYPHENRANGELOOSE] = "^\\s*(" + src[t.XRANGEPLAINLOOSE] + ")\\s+-\\s+(" + src[t.XRANGEPLAINLOOSE] + ")\\s*$";
    tok("STAR");
    src[t.STAR] = "(<|>)?=?\\s*\\*";
    for (var i = 0; i < R; i++) {
      debug(i, src[i]);
      if (!re2[i]) {
        re2[i] = new RegExp(src[i]);
        safeRe[i] = new RegExp(makeSafeRe(src[i]));
      }
    }
    exports.parse = parse;
    function parse(version, options) {
      if (!options || typeof options !== "object") {
        options = {
          loose: !!options,
          includePrerelease: false
        };
      }
      if (version instanceof SemVer) {
        return version;
      }
      if (typeof version !== "string") {
        return null;
      }
      if (version.length > MAX_LENGTH) {
        return null;
      }
      var r = options.loose ? safeRe[t.LOOSE] : safeRe[t.FULL];
      if (!r.test(version)) {
        return null;
      }
      try {
        return new SemVer(version, options);
      } catch (er) {
        return null;
      }
    }
    exports.valid = valid2;
    function valid2(version, options) {
      var v = parse(version, options);
      return v ? v.version : null;
    }
    exports.clean = clean;
    function clean(version, options) {
      var s = parse(version.trim().replace(/^[=v]+/, ""), options);
      return s ? s.version : null;
    }
    exports.SemVer = SemVer;
    function SemVer(version, options) {
      if (!options || typeof options !== "object") {
        options = {
          loose: !!options,
          includePrerelease: false
        };
      }
      if (version instanceof SemVer) {
        if (version.loose === options.loose) {
          return version;
        } else {
          version = version.version;
        }
      } else if (typeof version !== "string") {
        throw new TypeError("Invalid Version: " + version);
      }
      if (version.length > MAX_LENGTH) {
        throw new TypeError("version is longer than " + MAX_LENGTH + " characters");
      }
      if (!(this instanceof SemVer)) {
        return new SemVer(version, options);
      }
      debug("SemVer", version, options);
      this.options = options;
      this.loose = !!options.loose;
      var m = version.trim().match(options.loose ? safeRe[t.LOOSE] : safeRe[t.FULL]);
      if (!m) {
        throw new TypeError("Invalid Version: " + version);
      }
      this.raw = version;
      this.major = +m[1];
      this.minor = +m[2];
      this.patch = +m[3];
      if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
        throw new TypeError("Invalid major version");
      }
      if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
        throw new TypeError("Invalid minor version");
      }
      if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
        throw new TypeError("Invalid patch version");
      }
      if (!m[4]) {
        this.prerelease = [];
      } else {
        this.prerelease = m[4].split(".").map(function(id2) {
          if (/^[0-9]+$/.test(id2)) {
            var num = +id2;
            if (num >= 0 && num < MAX_SAFE_INTEGER) {
              return num;
            }
          }
          return id2;
        });
      }
      this.build = m[5] ? m[5].split(".") : [];
      this.format();
    }
    SemVer.prototype.format = function() {
      this.version = this.major + "." + this.minor + "." + this.patch;
      if (this.prerelease.length) {
        this.version += "-" + this.prerelease.join(".");
      }
      return this.version;
    };
    SemVer.prototype.toString = function() {
      return this.version;
    };
    SemVer.prototype.compare = function(other) {
      debug("SemVer.compare", this.version, this.options, other);
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      return this.compareMain(other) || this.comparePre(other);
    };
    SemVer.prototype.compareMain = function(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      return compareIdentifiers(this.major, other.major) || compareIdentifiers(this.minor, other.minor) || compareIdentifiers(this.patch, other.patch);
    };
    SemVer.prototype.comparePre = function(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      if (this.prerelease.length && !other.prerelease.length) {
        return -1;
      } else if (!this.prerelease.length && other.prerelease.length) {
        return 1;
      } else if (!this.prerelease.length && !other.prerelease.length) {
        return 0;
      }
      var i2 = 0;
      do {
        var a = this.prerelease[i2];
        var b = other.prerelease[i2];
        debug("prerelease compare", i2, a, b);
        if (a === void 0 && b === void 0) {
          return 0;
        } else if (b === void 0) {
          return 1;
        } else if (a === void 0) {
          return -1;
        } else if (a === b) {
          continue;
        } else {
          return compareIdentifiers(a, b);
        }
      } while (++i2);
    };
    SemVer.prototype.compareBuild = function(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      var i2 = 0;
      do {
        var a = this.build[i2];
        var b = other.build[i2];
        debug("prerelease compare", i2, a, b);
        if (a === void 0 && b === void 0) {
          return 0;
        } else if (b === void 0) {
          return 1;
        } else if (a === void 0) {
          return -1;
        } else if (a === b) {
          continue;
        } else {
          return compareIdentifiers(a, b);
        }
      } while (++i2);
    };
    SemVer.prototype.inc = function(release2, identifier) {
      switch (release2) {
        case "premajor":
          this.prerelease.length = 0;
          this.patch = 0;
          this.minor = 0;
          this.major++;
          this.inc("pre", identifier);
          break;
        case "preminor":
          this.prerelease.length = 0;
          this.patch = 0;
          this.minor++;
          this.inc("pre", identifier);
          break;
        case "prepatch":
          this.prerelease.length = 0;
          this.inc("patch", identifier);
          this.inc("pre", identifier);
          break;
        // If the input is a non-prerelease version, this acts the same as
        // prepatch.
        case "prerelease":
          if (this.prerelease.length === 0) {
            this.inc("patch", identifier);
          }
          this.inc("pre", identifier);
          break;
        case "major":
          if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
            this.major++;
          }
          this.minor = 0;
          this.patch = 0;
          this.prerelease = [];
          break;
        case "minor":
          if (this.patch !== 0 || this.prerelease.length === 0) {
            this.minor++;
          }
          this.patch = 0;
          this.prerelease = [];
          break;
        case "patch":
          if (this.prerelease.length === 0) {
            this.patch++;
          }
          this.prerelease = [];
          break;
        // This probably shouldn't be used publicly.
        // 1.0.0 "pre" would become 1.0.0-0 which is the wrong direction.
        case "pre":
          if (this.prerelease.length === 0) {
            this.prerelease = [0];
          } else {
            var i2 = this.prerelease.length;
            while (--i2 >= 0) {
              if (typeof this.prerelease[i2] === "number") {
                this.prerelease[i2]++;
                i2 = -2;
              }
            }
            if (i2 === -1) {
              this.prerelease.push(0);
            }
          }
          if (identifier) {
            if (this.prerelease[0] === identifier) {
              if (isNaN(this.prerelease[1])) {
                this.prerelease = [identifier, 0];
              }
            } else {
              this.prerelease = [identifier, 0];
            }
          }
          break;
        default:
          throw new Error("invalid increment argument: " + release2);
      }
      this.format();
      this.raw = this.version;
      return this;
    };
    exports.inc = inc;
    function inc(version, release2, loose, identifier) {
      if (typeof loose === "string") {
        identifier = loose;
        loose = void 0;
      }
      try {
        return new SemVer(version, loose).inc(release2, identifier).version;
      } catch (er) {
        return null;
      }
    }
    exports.diff = diff;
    function diff(version1, version2) {
      if (eq(version1, version2)) {
        return null;
      } else {
        var v1 = parse(version1);
        var v2 = parse(version2);
        var prefix = "";
        if (v1.prerelease.length || v2.prerelease.length) {
          prefix = "pre";
          var defaultResult = "prerelease";
        }
        for (var key in v1) {
          if (key === "major" || key === "minor" || key === "patch") {
            if (v1[key] !== v2[key]) {
              return prefix + key;
            }
          }
        }
        return defaultResult;
      }
    }
    exports.compareIdentifiers = compareIdentifiers;
    var numeric = /^[0-9]+$/;
    function compareIdentifiers(a, b) {
      var anum = numeric.test(a);
      var bnum = numeric.test(b);
      if (anum && bnum) {
        a = +a;
        b = +b;
      }
      return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
    }
    exports.rcompareIdentifiers = rcompareIdentifiers;
    function rcompareIdentifiers(a, b) {
      return compareIdentifiers(b, a);
    }
    exports.major = major;
    function major(a, loose) {
      return new SemVer(a, loose).major;
    }
    exports.minor = minor;
    function minor(a, loose) {
      return new SemVer(a, loose).minor;
    }
    exports.patch = patch;
    function patch(a, loose) {
      return new SemVer(a, loose).patch;
    }
    exports.compare = compare;
    function compare(a, b, loose) {
      return new SemVer(a, loose).compare(new SemVer(b, loose));
    }
    exports.compareLoose = compareLoose;
    function compareLoose(a, b) {
      return compare(a, b, true);
    }
    exports.compareBuild = compareBuild;
    function compareBuild(a, b, loose) {
      var versionA = new SemVer(a, loose);
      var versionB = new SemVer(b, loose);
      return versionA.compare(versionB) || versionA.compareBuild(versionB);
    }
    exports.rcompare = rcompare;
    function rcompare(a, b, loose) {
      return compare(b, a, loose);
    }
    exports.sort = sort;
    function sort(list, loose) {
      return list.sort(function(a, b) {
        return exports.compareBuild(a, b, loose);
      });
    }
    exports.rsort = rsort;
    function rsort(list, loose) {
      return list.sort(function(a, b) {
        return exports.compareBuild(b, a, loose);
      });
    }
    exports.gt = gt;
    function gt(a, b, loose) {
      return compare(a, b, loose) > 0;
    }
    exports.lt = lt;
    function lt(a, b, loose) {
      return compare(a, b, loose) < 0;
    }
    exports.eq = eq;
    function eq(a, b, loose) {
      return compare(a, b, loose) === 0;
    }
    exports.neq = neq;
    function neq(a, b, loose) {
      return compare(a, b, loose) !== 0;
    }
    exports.gte = gte;
    function gte(a, b, loose) {
      return compare(a, b, loose) >= 0;
    }
    exports.lte = lte;
    function lte(a, b, loose) {
      return compare(a, b, loose) <= 0;
    }
    exports.cmp = cmp;
    function cmp(a, op, b, loose) {
      switch (op) {
        case "===":
          if (typeof a === "object")
            a = a.version;
          if (typeof b === "object")
            b = b.version;
          return a === b;
        case "!==":
          if (typeof a === "object")
            a = a.version;
          if (typeof b === "object")
            b = b.version;
          return a !== b;
        case "":
        case "=":
        case "==":
          return eq(a, b, loose);
        case "!=":
          return neq(a, b, loose);
        case ">":
          return gt(a, b, loose);
        case ">=":
          return gte(a, b, loose);
        case "<":
          return lt(a, b, loose);
        case "<=":
          return lte(a, b, loose);
        default:
          throw new TypeError("Invalid operator: " + op);
      }
    }
    exports.Comparator = Comparator;
    function Comparator(comp, options) {
      if (!options || typeof options !== "object") {
        options = {
          loose: !!options,
          includePrerelease: false
        };
      }
      if (comp instanceof Comparator) {
        if (comp.loose === !!options.loose) {
          return comp;
        } else {
          comp = comp.value;
        }
      }
      if (!(this instanceof Comparator)) {
        return new Comparator(comp, options);
      }
      comp = comp.trim().split(/\s+/).join(" ");
      debug("comparator", comp, options);
      this.options = options;
      this.loose = !!options.loose;
      this.parse(comp);
      if (this.semver === ANY) {
        this.value = "";
      } else {
        this.value = this.operator + this.semver.version;
      }
      debug("comp", this);
    }
    var ANY = {};
    Comparator.prototype.parse = function(comp) {
      var r = this.options.loose ? safeRe[t.COMPARATORLOOSE] : safeRe[t.COMPARATOR];
      var m = comp.match(r);
      if (!m) {
        throw new TypeError("Invalid comparator: " + comp);
      }
      this.operator = m[1] !== void 0 ? m[1] : "";
      if (this.operator === "=") {
        this.operator = "";
      }
      if (!m[2]) {
        this.semver = ANY;
      } else {
        this.semver = new SemVer(m[2], this.options.loose);
      }
    };
    Comparator.prototype.toString = function() {
      return this.value;
    };
    Comparator.prototype.test = function(version) {
      debug("Comparator.test", version, this.options.loose);
      if (this.semver === ANY || version === ANY) {
        return true;
      }
      if (typeof version === "string") {
        try {
          version = new SemVer(version, this.options);
        } catch (er) {
          return false;
        }
      }
      return cmp(version, this.operator, this.semver, this.options);
    };
    Comparator.prototype.intersects = function(comp, options) {
      if (!(comp instanceof Comparator)) {
        throw new TypeError("a Comparator is required");
      }
      if (!options || typeof options !== "object") {
        options = {
          loose: !!options,
          includePrerelease: false
        };
      }
      var rangeTmp;
      if (this.operator === "") {
        if (this.value === "") {
          return true;
        }
        rangeTmp = new Range(comp.value, options);
        return satisfies(this.value, rangeTmp, options);
      } else if (comp.operator === "") {
        if (comp.value === "") {
          return true;
        }
        rangeTmp = new Range(this.value, options);
        return satisfies(comp.semver, rangeTmp, options);
      }
      var sameDirectionIncreasing = (this.operator === ">=" || this.operator === ">") && (comp.operator === ">=" || comp.operator === ">");
      var sameDirectionDecreasing = (this.operator === "<=" || this.operator === "<") && (comp.operator === "<=" || comp.operator === "<");
      var sameSemVer = this.semver.version === comp.semver.version;
      var differentDirectionsInclusive = (this.operator === ">=" || this.operator === "<=") && (comp.operator === ">=" || comp.operator === "<=");
      var oppositeDirectionsLessThan = cmp(this.semver, "<", comp.semver, options) && ((this.operator === ">=" || this.operator === ">") && (comp.operator === "<=" || comp.operator === "<"));
      var oppositeDirectionsGreaterThan = cmp(this.semver, ">", comp.semver, options) && ((this.operator === "<=" || this.operator === "<") && (comp.operator === ">=" || comp.operator === ">"));
      return sameDirectionIncreasing || sameDirectionDecreasing || sameSemVer && differentDirectionsInclusive || oppositeDirectionsLessThan || oppositeDirectionsGreaterThan;
    };
    exports.Range = Range;
    function Range(range2, options) {
      if (!options || typeof options !== "object") {
        options = {
          loose: !!options,
          includePrerelease: false
        };
      }
      if (range2 instanceof Range) {
        if (range2.loose === !!options.loose && range2.includePrerelease === !!options.includePrerelease) {
          return range2;
        } else {
          return new Range(range2.raw, options);
        }
      }
      if (range2 instanceof Comparator) {
        return new Range(range2.value, options);
      }
      if (!(this instanceof Range)) {
        return new Range(range2, options);
      }
      this.options = options;
      this.loose = !!options.loose;
      this.includePrerelease = !!options.includePrerelease;
      this.raw = range2.trim().split(/\s+/).join(" ");
      this.set = this.raw.split("||").map(function(range22) {
        return this.parseRange(range22.trim());
      }, this).filter(function(c) {
        return c.length;
      });
      if (!this.set.length) {
        throw new TypeError("Invalid SemVer Range: " + this.raw);
      }
      this.format();
    }
    Range.prototype.format = function() {
      this.range = this.set.map(function(comps) {
        return comps.join(" ").trim();
      }).join("||").trim();
      return this.range;
    };
    Range.prototype.toString = function() {
      return this.range;
    };
    Range.prototype.parseRange = function(range2) {
      var loose = this.options.loose;
      var hr = loose ? safeRe[t.HYPHENRANGELOOSE] : safeRe[t.HYPHENRANGE];
      range2 = range2.replace(hr, hyphenReplace);
      debug("hyphen replace", range2);
      range2 = range2.replace(safeRe[t.COMPARATORTRIM], comparatorTrimReplace);
      debug("comparator trim", range2, safeRe[t.COMPARATORTRIM]);
      range2 = range2.replace(safeRe[t.TILDETRIM], tildeTrimReplace);
      range2 = range2.replace(safeRe[t.CARETTRIM], caretTrimReplace);
      range2 = range2.split(/\s+/).join(" ");
      var compRe = loose ? safeRe[t.COMPARATORLOOSE] : safeRe[t.COMPARATOR];
      var set = range2.split(" ").map(function(comp) {
        return parseComparator(comp, this.options);
      }, this).join(" ").split(/\s+/);
      if (this.options.loose) {
        set = set.filter(function(comp) {
          return !!comp.match(compRe);
        });
      }
      set = set.map(function(comp) {
        return new Comparator(comp, this.options);
      }, this);
      return set;
    };
    Range.prototype.intersects = function(range2, options) {
      if (!(range2 instanceof Range)) {
        throw new TypeError("a Range is required");
      }
      return this.set.some(function(thisComparators) {
        return isSatisfiable(thisComparators, options) && range2.set.some(function(rangeComparators) {
          return isSatisfiable(rangeComparators, options) && thisComparators.every(function(thisComparator) {
            return rangeComparators.every(function(rangeComparator) {
              return thisComparator.intersects(rangeComparator, options);
            });
          });
        });
      });
    };
    function isSatisfiable(comparators, options) {
      var result = true;
      var remainingComparators = comparators.slice();
      var testComparator = remainingComparators.pop();
      while (result && remainingComparators.length) {
        result = remainingComparators.every(function(otherComparator) {
          return testComparator.intersects(otherComparator, options);
        });
        testComparator = remainingComparators.pop();
      }
      return result;
    }
    exports.toComparators = toComparators;
    function toComparators(range2, options) {
      return new Range(range2, options).set.map(function(comp) {
        return comp.map(function(c) {
          return c.value;
        }).join(" ").trim().split(" ");
      });
    }
    function parseComparator(comp, options) {
      debug("comp", comp, options);
      comp = replaceCarets(comp, options);
      debug("caret", comp);
      comp = replaceTildes(comp, options);
      debug("tildes", comp);
      comp = replaceXRanges(comp, options);
      debug("xrange", comp);
      comp = replaceStars(comp, options);
      debug("stars", comp);
      return comp;
    }
    function isX(id2) {
      return !id2 || id2.toLowerCase() === "x" || id2 === "*";
    }
    function replaceTildes(comp, options) {
      return comp.trim().split(/\s+/).map(function(comp2) {
        return replaceTilde(comp2, options);
      }).join(" ");
    }
    function replaceTilde(comp, options) {
      var r = options.loose ? safeRe[t.TILDELOOSE] : safeRe[t.TILDE];
      return comp.replace(r, function(_, M, m, p, pr) {
        debug("tilde", comp, _, M, m, p, pr);
        var ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = ">=" + M + ".0.0 <" + (+M + 1) + ".0.0";
        } else if (isX(p)) {
          ret = ">=" + M + "." + m + ".0 <" + M + "." + (+m + 1) + ".0";
        } else if (pr) {
          debug("replaceTilde pr", pr);
          ret = ">=" + M + "." + m + "." + p + "-" + pr + " <" + M + "." + (+m + 1) + ".0";
        } else {
          ret = ">=" + M + "." + m + "." + p + " <" + M + "." + (+m + 1) + ".0";
        }
        debug("tilde return", ret);
        return ret;
      });
    }
    function replaceCarets(comp, options) {
      return comp.trim().split(/\s+/).map(function(comp2) {
        return replaceCaret(comp2, options);
      }).join(" ");
    }
    function replaceCaret(comp, options) {
      debug("caret", comp, options);
      var r = options.loose ? safeRe[t.CARETLOOSE] : safeRe[t.CARET];
      return comp.replace(r, function(_, M, m, p, pr) {
        debug("caret", comp, _, M, m, p, pr);
        var ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = ">=" + M + ".0.0 <" + (+M + 1) + ".0.0";
        } else if (isX(p)) {
          if (M === "0") {
            ret = ">=" + M + "." + m + ".0 <" + M + "." + (+m + 1) + ".0";
          } else {
            ret = ">=" + M + "." + m + ".0 <" + (+M + 1) + ".0.0";
          }
        } else if (pr) {
          debug("replaceCaret pr", pr);
          if (M === "0") {
            if (m === "0") {
              ret = ">=" + M + "." + m + "." + p + "-" + pr + " <" + M + "." + m + "." + (+p + 1);
            } else {
              ret = ">=" + M + "." + m + "." + p + "-" + pr + " <" + M + "." + (+m + 1) + ".0";
            }
          } else {
            ret = ">=" + M + "." + m + "." + p + "-" + pr + " <" + (+M + 1) + ".0.0";
          }
        } else {
          debug("no pr");
          if (M === "0") {
            if (m === "0") {
              ret = ">=" + M + "." + m + "." + p + " <" + M + "." + m + "." + (+p + 1);
            } else {
              ret = ">=" + M + "." + m + "." + p + " <" + M + "." + (+m + 1) + ".0";
            }
          } else {
            ret = ">=" + M + "." + m + "." + p + " <" + (+M + 1) + ".0.0";
          }
        }
        debug("caret return", ret);
        return ret;
      });
    }
    function replaceXRanges(comp, options) {
      debug("replaceXRanges", comp, options);
      return comp.split(/\s+/).map(function(comp2) {
        return replaceXRange(comp2, options);
      }).join(" ");
    }
    function replaceXRange(comp, options) {
      comp = comp.trim();
      var r = options.loose ? safeRe[t.XRANGELOOSE] : safeRe[t.XRANGE];
      return comp.replace(r, function(ret, gtlt, M, m, p, pr) {
        debug("xRange", comp, ret, gtlt, M, m, p, pr);
        var xM = isX(M);
        var xm = xM || isX(m);
        var xp = xm || isX(p);
        var anyX = xp;
        if (gtlt === "=" && anyX) {
          gtlt = "";
        }
        pr = options.includePrerelease ? "-0" : "";
        if (xM) {
          if (gtlt === ">" || gtlt === "<") {
            ret = "<0.0.0-0";
          } else {
            ret = "*";
          }
        } else if (gtlt && anyX) {
          if (xm) {
            m = 0;
          }
          p = 0;
          if (gtlt === ">") {
            gtlt = ">=";
            if (xm) {
              M = +M + 1;
              m = 0;
              p = 0;
            } else {
              m = +m + 1;
              p = 0;
            }
          } else if (gtlt === "<=") {
            gtlt = "<";
            if (xm) {
              M = +M + 1;
            } else {
              m = +m + 1;
            }
          }
          ret = gtlt + M + "." + m + "." + p + pr;
        } else if (xm) {
          ret = ">=" + M + ".0.0" + pr + " <" + (+M + 1) + ".0.0" + pr;
        } else if (xp) {
          ret = ">=" + M + "." + m + ".0" + pr + " <" + M + "." + (+m + 1) + ".0" + pr;
        }
        debug("xRange return", ret);
        return ret;
      });
    }
    function replaceStars(comp, options) {
      debug("replaceStars", comp, options);
      return comp.trim().replace(safeRe[t.STAR], "");
    }
    function hyphenReplace($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr, tb) {
      if (isX(fM)) {
        from = "";
      } else if (isX(fm)) {
        from = ">=" + fM + ".0.0";
      } else if (isX(fp)) {
        from = ">=" + fM + "." + fm + ".0";
      } else {
        from = ">=" + from;
      }
      if (isX(tM)) {
        to = "";
      } else if (isX(tm)) {
        to = "<" + (+tM + 1) + ".0.0";
      } else if (isX(tp)) {
        to = "<" + tM + "." + (+tm + 1) + ".0";
      } else if (tpr) {
        to = "<=" + tM + "." + tm + "." + tp + "-" + tpr;
      } else {
        to = "<=" + to;
      }
      return (from + " " + to).trim();
    }
    Range.prototype.test = function(version) {
      if (!version) {
        return false;
      }
      if (typeof version === "string") {
        try {
          version = new SemVer(version, this.options);
        } catch (er) {
          return false;
        }
      }
      for (var i2 = 0; i2 < this.set.length; i2++) {
        if (testSet(this.set[i2], version, this.options)) {
          return true;
        }
      }
      return false;
    };
    function testSet(set, version, options) {
      for (var i2 = 0; i2 < set.length; i2++) {
        if (!set[i2].test(version)) {
          return false;
        }
      }
      if (version.prerelease.length && !options.includePrerelease) {
        for (i2 = 0; i2 < set.length; i2++) {
          debug(set[i2].semver);
          if (set[i2].semver === ANY) {
            continue;
          }
          if (set[i2].semver.prerelease.length > 0) {
            var allowed = set[i2].semver;
            if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) {
              return true;
            }
          }
        }
        return false;
      }
      return true;
    }
    exports.satisfies = satisfies;
    function satisfies(version, range2, options) {
      try {
        range2 = new Range(range2, options);
      } catch (er) {
        return false;
      }
      return range2.test(version);
    }
    exports.maxSatisfying = maxSatisfying;
    function maxSatisfying(versions, range2, options) {
      var max = null;
      var maxSV = null;
      try {
        var rangeObj = new Range(range2, options);
      } catch (er) {
        return null;
      }
      versions.forEach(function(v) {
        if (rangeObj.test(v)) {
          if (!max || maxSV.compare(v) === -1) {
            max = v;
            maxSV = new SemVer(max, options);
          }
        }
      });
      return max;
    }
    exports.minSatisfying = minSatisfying;
    function minSatisfying(versions, range2, options) {
      var min = null;
      var minSV = null;
      try {
        var rangeObj = new Range(range2, options);
      } catch (er) {
        return null;
      }
      versions.forEach(function(v) {
        if (rangeObj.test(v)) {
          if (!min || minSV.compare(v) === 1) {
            min = v;
            minSV = new SemVer(min, options);
          }
        }
      });
      return min;
    }
    exports.minVersion = minVersion;
    function minVersion(range2, loose) {
      range2 = new Range(range2, loose);
      var minver = new SemVer("0.0.0");
      if (range2.test(minver)) {
        return minver;
      }
      minver = new SemVer("0.0.0-0");
      if (range2.test(minver)) {
        return minver;
      }
      minver = null;
      for (var i2 = 0; i2 < range2.set.length; ++i2) {
        var comparators = range2.set[i2];
        comparators.forEach(function(comparator2) {
          var compver = new SemVer(comparator2.semver.version);
          switch (comparator2.operator) {
            case ">":
              if (compver.prerelease.length === 0) {
                compver.patch++;
              } else {
                compver.prerelease.push(0);
              }
              compver.raw = compver.format();
            /* fallthrough */
            case "":
            case ">=":
              if (!minver || gt(minver, compver)) {
                minver = compver;
              }
              break;
            case "<":
            case "<=":
              break;
            /* istanbul ignore next */
            default:
              throw new Error("Unexpected operation: " + comparator2.operator);
          }
        });
      }
      if (minver && range2.test(minver)) {
        return minver;
      }
      return null;
    }
    exports.validRange = validRange;
    function validRange(range2, options) {
      try {
        return new Range(range2, options).range || "*";
      } catch (er) {
        return null;
      }
    }
    exports.ltr = ltr;
    function ltr(version, range2, options) {
      return outside(version, range2, "<", options);
    }
    exports.gtr = gtr;
    function gtr(version, range2, options) {
      return outside(version, range2, ">", options);
    }
    exports.outside = outside;
    function outside(version, range2, hilo, options) {
      version = new SemVer(version, options);
      range2 = new Range(range2, options);
      var gtfn, ltefn, ltfn, comp, ecomp;
      switch (hilo) {
        case ">":
          gtfn = gt;
          ltefn = lte;
          ltfn = lt;
          comp = ">";
          ecomp = ">=";
          break;
        case "<":
          gtfn = lt;
          ltefn = gte;
          ltfn = gt;
          comp = "<";
          ecomp = "<=";
          break;
        default:
          throw new TypeError('Must provide a hilo val of "<" or ">"');
      }
      if (satisfies(version, range2, options)) {
        return false;
      }
      for (var i2 = 0; i2 < range2.set.length; ++i2) {
        var comparators = range2.set[i2];
        var high = null;
        var low = null;
        comparators.forEach(function(comparator2) {
          if (comparator2.semver === ANY) {
            comparator2 = new Comparator(">=0.0.0");
          }
          high = high || comparator2;
          low = low || comparator2;
          if (gtfn(comparator2.semver, high.semver, options)) {
            high = comparator2;
          } else if (ltfn(comparator2.semver, low.semver, options)) {
            low = comparator2;
          }
        });
        if (high.operator === comp || high.operator === ecomp) {
          return false;
        }
        if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) {
          return false;
        } else if (low.operator === ecomp && ltfn(version, low.semver)) {
          return false;
        }
      }
      return true;
    }
    exports.prerelease = prerelease;
    function prerelease(version, options) {
      var parsed = parse(version, options);
      return parsed && parsed.prerelease.length ? parsed.prerelease : null;
    }
    exports.intersects = intersects;
    function intersects(r1, r2, options) {
      r1 = new Range(r1, options);
      r2 = new Range(r2, options);
      return r1.intersects(r2);
    }
    exports.coerce = coerce;
    function coerce(version, options) {
      if (version instanceof SemVer) {
        return version;
      }
      if (typeof version === "number") {
        version = String(version);
      }
      if (typeof version !== "string") {
        return null;
      }
      options = options || {};
      var match = null;
      if (!options.rtl) {
        match = version.match(safeRe[t.COERCE]);
      } else {
        var next;
        while ((next = safeRe[t.COERCERTL].exec(version)) && (!match || match.index + match[0].length !== version.length)) {
          if (!match || next.index + next[0].length !== match.index + match[0].length) {
            match = next;
          }
          safeRe[t.COERCERTL].lastIndex = next.index + next[1].length + next[2].length;
        }
        safeRe[t.COERCERTL].lastIndex = -1;
      }
      if (match === null) {
        return null;
      }
      return parse(match[2] + "." + (match[3] || "0") + "." + (match[4] || "0"), options);
    }
  })(semver, semver.exports);
  return semver.exports;
}
var semverExports = requireSemver();
const processState = async (pid) => {
  if (!Number.isSafeInteger(pid) || pid <= 0) return "missing";
  try {
    process.kill(pid, 0);
    return "running";
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "EPERM" ? "running" : "missing";
  }
};
const completed = (step) => step.status === "completed" || step.status === "skipped";
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "task";
class TaskRuntime {
  constructor(dependencies) {
    this.dependencies = dependencies;
    this.now = dependencies.now ?? Date.now;
    this.inspectProcess = dependencies.processState ?? processState;
  }
  now;
  inspectProcess;
  create(draft) {
    return this.dependencies.storage.createPersistentTask(draft);
  }
  update(taskId, draft) {
    return this.dependencies.storage.updatePersistentTask(taskId, draft);
  }
  list() {
    return this.dependencies.storage.listPersistentTasks();
  }
  get(taskId) {
    return this.dependencies.storage.getPersistentTask(taskId);
  }
  async createRelease(version, originatingConversationId) {
    if (!semverExports.valid(version)) throw new Error("Release version must be a valid semantic version without a leading v.");
    return this.create(releaseTaskTemplate(version, originatingConversationId));
  }
  async realitySnapshot(taskId) {
    const task = await this.get(taskId);
    const workspaceId = await this.dependencies.storage.workspaceId();
    const pids = [.../* @__PURE__ */ new Set([...task.processIds, ...task.steps.flatMap((step) => step.externalProcessId ? [step.externalProcessId] : [])])];
    const processes = await Promise.all(pids.map(async (pid) => ({ pid, state: await this.inspectProcess(pid) })));
    let git2;
    if (this.dependencies.git) {
      try {
        const status = await this.dependencies.git.status();
        git2 = { branch: status.branch, commitSha: status.head?.hash, workingTreeClean: status.files.length === 0 };
      } catch {
        git2 = void 0;
      }
    }
    return { observedAt: this.now(), workspaceId, git: git2, processes, stepObservations: [] };
  }
  async resume(taskId, suppliedSnapshot) {
    const before = await this.get(taskId);
    if (before.status === "completed" || before.status === "cancelled") return before;
    if (before.startedAt === void 0) {
      await this.dependencies.storage.setPersistentTaskState(taskId, "running", { summary: "Task started; persisted state will be reconciled before any work continues.", eventType: "task.started", currentStepId: before.currentStepId ?? null, resumabilityState: "reconcile-required" });
    } else {
      await this.dependencies.storage.appendTaskEvent(taskId, { type: "task.resumed", summary: "Resume requested; persisted state will be reconciled before any work continues." });
    }
    return this.reconcile(taskId, suppliedSnapshot ?? await this.realitySnapshot(taskId));
  }
  async reconcile(taskId, snapshot) {
    let task = await this.get(taskId);
    if (snapshot.workspaceId !== task.workspaceId) throw new Error("Reality snapshot belongs to another workspace.");
    await this.dependencies.storage.updateTaskReality(taskId, { associatedBranch: snapshot.git?.branch, associatedCommitSha: snapshot.git?.commitSha, processIds: snapshot.processes.filter((entry) => entry.state === "running").map((entry) => entry.pid) });
    const observations = new Map(snapshot.stepObservations.map((observation) => [observation.stepId, observation]));
    for (const observation of snapshot.stepObservations) {
      const step = task.steps.find((candidate) => candidate.id === observation.stepId);
      if (!step || completed(step)) continue;
      if (observation.state === "completed" && observation.verified) {
        await this.dependencies.storage.setTaskStepState(taskId, step.id, "completed", { summary: observation.summary, auditReference: observation.auditReference, eventType: "step.completed" });
        await this.dependencies.storage.appendTaskCheckpoint(taskId, { stepId: step.id, name: `${step.name} completed`, summary: observation.summary, verified: true, evidence: observation.evidence, auditReferences: observation.auditReference ? [observation.auditReference] : [] });
        if (observation.auditReference) await this.dependencies.storage.linkTaskStepAudit(taskId, step.id, observation.auditReference);
        const evidence = observation.evidence;
        if (evidence?.externalReference) {
          const reference = await this.dependencies.storage.upsertTaskExternalReference(taskId, { ...evidence.externalReference, stepId: step.id });
          await this.dependencies.storage.updateTaskReality(taskId, { externalResourceIds: [.../* @__PURE__ */ new Set([...task.externalResourceIds, reference.id])] });
          await this.dependencies.storage.appendTaskEvent(taskId, { stepId: step.id, type: "external.asset.verified", summary: observation.summary, details: { externalReferenceId: reference.id }, auditReference: observation.auditReference });
        }
        if (evidence?.artifact) await this.dependencies.storage.appendTaskArtifact(taskId, { ...evidence.artifact, stepId: step.id });
      } else if (observation.state === "failed") {
        await this.dependencies.storage.setTaskStepState(taskId, step.id, "failed", { summary: observation.summary, error: observation.error ?? { message: observation.summary, retryable: false }, auditReference: observation.auditReference, eventType: "step.failed" });
      } else if (observation.state === "running") {
        await this.dependencies.storage.setTaskStepState(taskId, step.id, "running", { summary: observation.summary, externalProcessId: step.externalProcessId, auditReference: observation.auditReference, eventType: "external.process.detected" });
      } else {
        await this.dependencies.storage.setTaskStepState(taskId, step.id, "waiting", { summary: observation.summary, auditReference: observation.auditReference, eventType: "step.waiting" });
      }
    }
    task = await this.get(taskId);
    for (const step of task.steps) {
      if (step.status !== "running" || !step.externalProcessId || observations.has(step.id)) continue;
      const observed = snapshot.processes.find((entry) => entry.pid === step.externalProcessId);
      if (!observed || observed.state === "missing" || observed.state === "exited") {
        await this.dependencies.storage.setTaskStepState(taskId, step.id, "blocked", { summary: `Tracked process ${step.externalProcessId} is no longer running and no verified completion evidence was found.`, error: { message: "Tracked process disappeared before its result was verified.", exitCode: observed?.exitCode, retryable: true, suggestedNextAction: "Inspect the bounded output and remote state before retrying." }, eventType: "task.blocked" });
      }
    }
    task = await this.get(taskId);
    const incompleteDependencies = [];
    for (const dependencyId of task.taskDependencies) {
      const dependency = await this.get(dependencyId);
      if (dependency.status !== "completed") incompleteDependencies.push(dependencyId);
    }
    const allComplete = task.steps.length > 0 && task.steps.every(completed);
    if (allComplete) return this.dependencies.storage.setPersistentTaskState(taskId, "completed", { summary: "Every task step has verified completion or an explicit skip.", eventType: "task.completed", currentStepId: null, resumabilityState: "complete", details: { observedAt: snapshot.observedAt } });
    const failed = task.steps.find((step) => step.status === "failed");
    if (failed) return this.dependencies.storage.setPersistentTaskState(taskId, "failed", { summary: `Step failed: ${failed.name}`, eventType: "state.reconciled", currentStepId: failed.id, interruptionReason: failed.lastError?.message, resumabilityState: failed.attempts < failed.retryPolicy.maxAttempts ? "resumable" : "not-resumable" });
    const blocked = task.steps.find((step) => step.status === "blocked");
    if (blocked || incompleteDependencies.length) return this.dependencies.storage.setPersistentTaskState(taskId, "blocked", { summary: blocked ? `Blocked at ${blocked.name}.` : "Waiting for dependent tasks to complete.", eventType: "state.reconciled", currentStepId: blocked?.id ?? null, interruptionReason: blocked?.lastError?.message ?? `Incomplete task dependencies: ${incompleteDependencies.join(", ")}`, resumabilityState: "reconcile-required" });
    const running = task.steps.find((step) => step.status === "running");
    if (running) return this.dependencies.storage.setPersistentTaskState(taskId, "running", { summary: `${running.name} is still running.`, eventType: "state.reconciled", currentStepId: running.id, resumabilityState: "reconcile-required", details: { observedAt: snapshot.observedAt, processId: running.externalProcessId } });
    const next = task.steps.find((step) => !completed(step) && step.dependencies.every((dependencyId) => completed(task.steps.find((candidate) => candidate.id === dependencyId))));
    if (!next) return this.dependencies.storage.setPersistentTaskState(taskId, "blocked", { summary: "No dependency-ready step is available.", eventType: "state.reconciled", currentStepId: null, interruptionReason: "Step dependency graph cannot advance.", resumabilityState: "reconcile-required" });
    if (next.status === "waiting") return this.dependencies.storage.setPersistentTaskState(taskId, "waiting", { summary: `Verification or an external condition is still required for ${next.name}.`, eventType: "state.reconciled", currentStepId: next.id, resumabilityState: "reconcile-required", details: { observedAt: snapshot.observedAt } });
    return this.dependencies.storage.setPersistentTaskState(taskId, "ready", { summary: `Ready for ${next.name}.`, eventType: "state.reconciled", currentStepId: next.id, resumabilityState: "resumable", details: { observedAt: snapshot.observedAt, git: snapshot.git } });
  }
  async pause(taskId, reason2) {
    if (!reason2.trim() || reason2.length > 4e3) throw new Error("A bounded pause reason is required.");
    const task = await this.get(taskId);
    if (task.status === "completed" || task.status === "cancelled") return task;
    return this.dependencies.storage.setPersistentTaskState(taskId, "paused", { summary: `Paused: ${reason2}`, eventType: "task.paused", interruptionReason: reason2, currentStepId: task.currentStepId, resumabilityState: "reconcile-required" });
  }
  async redirect(taskId, instruction) {
    const normalized = instruction.trim();
    if (!normalized || normalized.length > 4e3) throw new Error("A redirect instruction between 1 and 4,000 characters is required.");
    const task = await this.get(taskId);
    if (["completed", "cancelled"].includes(task.status)) throw new Error("Completed or cancelled tasks cannot receive redirect instructions.");
    await this.dependencies.storage.appendTaskEvent(taskId, { type: "task.redirected", summary: `Redirect instruction queued: ${normalized.slice(0, 240)}`, details: { instruction: normalized } });
    return this.get(taskId);
  }
  async pendingRedirects(taskId) {
    const task = await this.get(taskId);
    const consumed = new Set(task.events.filter((event) => event.type === "task.redirect.consumed" && typeof event.details?.eventId === "string").map((event) => event.details.eventId));
    return task.events.filter((event) => event.type === "task.redirected" && !consumed.has(event.id) && typeof event.details?.instruction === "string").map((event) => ({ eventId: event.id, instruction: event.details.instruction }));
  }
  async acknowledgeRedirects(taskId, eventIds) {
    const available = new Set((await this.pendingRedirects(taskId)).map((entry) => entry.eventId));
    for (const eventId of eventIds) if (available.has(eventId)) await this.dependencies.storage.appendTaskEvent(taskId, { type: "task.redirect.consumed", summary: "Queued redirect instruction was delivered to the active agent.", details: { eventId } });
  }
  async cancel(taskId, reason2, trackingOnly) {
    if (!reason2.trim() || reason2.length > 4e3) throw new Error("A bounded cancellation reason is required.");
    const task = await this.get(taskId);
    const activeSteps = task.steps.filter((step) => step.status === "running" && step.externalProcessId);
    const activePids = [...new Set(activeSteps.map((step) => step.externalProcessId))];
    if (activePids.length && !trackingOnly) {
      for (const step of activeSteps) {
        const requestId = step.auditReferences.at(-1);
        if (!requestId || !this.dependencies.shell?.cancel?.(requestId)) throw new Error(`Task process ${step.externalProcessId} could not be cancelled through its tracked shell request ${requestId ?? "(missing)"}. Task state was not changed.`);
      }
    }
    const summary = activePids.length && trackingOnly ? `FORGE tracking cancelled; external process IDs may still be active: ${activePids.join(", ")}.` : `Task cancelled: ${reason2}`;
    return this.dependencies.storage.setPersistentTaskState(taskId, "cancelled", { summary, eventType: "task.cancelled", interruptionReason: reason2, currentStepId: task.currentStepId, resumabilityState: "not-resumable", details: { trackingOnly, activePids } });
  }
  async stopAll() {
    const active = (await this.list()).filter((task) => !["completed", "cancelled"].includes(task.status));
    let cancelled = 0;
    for (const task of active) {
      await this.cancel(task.id, "Stop All was requested from FORGE.", false);
      cancelled += 1;
    }
    return cancelled;
  }
  async retryStep(taskId, stepId) {
    const task = await this.get(taskId);
    const step = task.steps.find((candidate) => candidate.id === stepId);
    if (!step) throw new Error("Unknown task step.");
    if (!["failed", "blocked"].includes(step.status)) throw new Error("Only failed or blocked steps can be retried.");
    if (step.attempts >= step.retryPolicy.maxAttempts) throw new Error("The task step retry limit has been reached.");
    if (!step.dependencies.every((dependencyId) => completed(task.steps.find((candidate) => candidate.id === dependencyId)))) throw new Error("Task step dependencies are not complete.");
    await this.dependencies.storage.setTaskStepState(taskId, stepId, "pending", { summary: `Retry queued for ${step.name}.`, eventType: "step.retried" });
    return this.dependencies.storage.setPersistentTaskState(taskId, "ready", { summary: `Ready to retry ${step.name}.`, eventType: "state.reconciled", currentStepId: step.id, resumabilityState: "resumable" });
  }
  async checkpoint(taskId, input) {
    if (!input.name.trim() || input.name.length > 240 || !input.summary.trim() || input.summary.length > 1e4 || JSON.stringify(input.evidence ?? null).length > 25e4) throw new Error("Checkpoint name, summary, or evidence exceeds the storage limit.");
    if (input.verified && !input.auditReference) throw new Error("A verified checkpoint requires an observed audit reference.");
    await this.dependencies.storage.appendTaskCheckpoint(taskId, { stepId: input.stepId, name: input.name, summary: input.summary, verified: input.verified, evidence: input.evidence, auditReferences: input.auditReference ? [input.auditReference] : [] });
    await this.dependencies.storage.appendTaskEvent(taskId, { stepId: input.stepId, type: "state.reconciled", summary: `Checkpoint recorded: ${input.name}.`, details: { verified: input.verified }, auditReference: input.auditReference });
    if (input.verified && input.stepId) {
      const task = await this.get(taskId);
      const step = task.steps.find((candidate) => candidate.id === input.stepId);
      if (!step) throw new Error("Unknown task step.");
      if (!completed(step)) await this.dependencies.storage.setTaskStepState(taskId, step.id, "completed", { summary: input.summary, auditReference: input.auditReference, eventType: "step.completed" });
      return this.reconcile(taskId, await this.realitySnapshot(taskId));
    }
    return this.get(taskId);
  }
  async recordToolOutcome(taskId, stepId, toolRequestId, result) {
    const task = await this.get(taskId);
    const step = task.steps.find((candidate) => candidate.id === stepId);
    if (!step) throw new Error("Unknown task step.");
    if (step.requiredTool && step.requiredTool !== result.toolName) throw new Error("Tool result does not match the task step contract.");
    await this.dependencies.storage.linkTaskStepAudit(taskId, stepId, toolRequestId);
    const succeeded = result.success && (result.exitCode === void 0 || result.exitCode === null || result.exitCode === 0);
    if (succeeded) {
      const processStarted = result.toolName === "task.process.start";
      await this.dependencies.storage.setTaskStepState(taskId, stepId, processStarted ? "running" : "waiting", { summary: processStarted ? `${step.name} started; completion still requires observed exit and verification evidence.` : `${step.name} returned a successful tool result; its verification criteria still require an explicit checkpoint.`, auditReference: toolRequestId, incrementAttempts: !processStarted, eventType: processStarted ? "external.process.detected" : "step.waiting" });
      await this.dependencies.storage.appendTaskCheckpoint(taskId, { stepId, name: `${step.name} tool result observed`, summary: processStarted ? "FORGE observed a successful background-process start, not completion." : "FORGE recorded a successful structured tool result. Step completion remains separately verified.", verified: true, evidence: { toolName: result.toolName, exitCode: result.exitCode, affectedPaths: result.affectedPaths, warnings: result.warnings }, auditReferences: [toolRequestId] });
    } else {
      const output = result.output;
      await this.dependencies.storage.setTaskStepState(taskId, stepId, "failed", { summary: `${step.name} failed.`, error: { message: result.error?.message ?? `Tool exited with code ${result.exitCode ?? "unknown"}.`, code: result.error?.code, exitCode: result.exitCode, stdout: typeof output?.stdout === "string" ? output.stdout.slice(0, 8e3) : void 0, stderr: typeof output?.stderr === "string" ? output.stderr.slice(0, 8e3) : void 0, retryable: !result.cancelled, suggestedNextAction: result.rollback?.instructions }, auditReference: toolRequestId, incrementAttempts: step.status !== "running", eventType: "step.failed" });
    }
    return this.reconcile(taskId, await this.realitySnapshot(taskId));
  }
  async startBackground(taskId, stepId, input, toolRequestId) {
    if (!this.dependencies.shell) throw new Error("Background shell runtime is unavailable.");
    const task = await this.get(taskId);
    const step = task.steps.find((candidate) => candidate.id === stepId);
    if (!step) throw new Error("Unknown task step.");
    if (!["shell.run", "task.process.start"].includes(step.requiredTool ?? "")) throw new Error("Task step is not configured for a background shell process.");
    if (!step.dependencies.every((dependencyId) => completed(task.steps.find((candidate) => candidate.id === dependencyId)))) throw new Error("Task step dependencies are not complete.");
    const outputPath = path__default.join(".forge", "task-output", taskId, `${slug(step.name)}.log`);
    await this.dependencies.storage.setTaskStepState(taskId, stepId, "running", { summary: `${step.name} is starting as a workspace-owned background process.`, incrementAttempts: true, auditReference: toolRequestId, eventType: "step.started" });
    try {
      const process2 = await this.dependencies.shell.startBackground(input, outputPath, toolRequestId, true);
      await this.dependencies.storage.setTaskStepState(taskId, stepId, "running", { summary: `${step.name} is running as process ${process2.pid}.`, externalProcessId: process2.pid, outputPath, auditReference: toolRequestId, eventType: "external.process.detected" });
      await this.dependencies.storage.updateTaskReality(taskId, { processIds: [.../* @__PURE__ */ new Set([...task.processIds, process2.pid])] });
      return { task: await this.get(taskId), process: process2 };
    } catch (error) {
      await this.dependencies.storage.setTaskStepState(taskId, stepId, "failed", { summary: `${step.name} could not start.`, error: { message: error instanceof Error ? error.message : String(error), retryable: true, suggestedNextAction: "Inspect the exact command, working directory, and output path before retrying." }, auditReference: toolRequestId, eventType: "step.failed" });
      throw error;
    }
  }
  async generateHandoff(taskId) {
    const task = await this.get(taskId);
    const root = this.dependencies.workspaceRoot();
    if (!root) throw new Error("Open a workspace before generating a task handoff.");
    const markdown = taskHandoffMarkdown(task);
    const directory = path__default.join(root, ".forge", "handoffs");
    const relativePath2 = path__default.join(".forge", "handoffs", `${slug(task.title)}-${task.id.slice(0, 8)}.md`);
    const destination = path__default.join(root, relativePath2);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    await promises.mkdir(directory, { recursive: true });
    try {
      await promises.writeFile(temporary, markdown, { flag: "wx" });
      await promises.rename(temporary, destination);
    } catch (error) {
      await promises.rm(temporary, { force: true });
      throw error;
    }
    const generatedAt = this.now();
    await this.dependencies.storage.appendTaskEvent(taskId, { type: "handoff.generated", summary: `Human-readable handoff generated at ${relativePath2}.`, details: { relativePath: relativePath2 } });
    return { taskId, relativePath: relativePath2, markdown, generatedAt };
  }
}
function releaseTaskTemplate(version, originatingConversationId) {
  if (!semverExports.valid(version)) throw new Error("Release version must be valid semantic versioning.");
  const specifications = [
    ["Version validation", "Confirm package and requested semantic versions agree.", 0, "file.read", ["package.json contains the requested version"]],
    ["Branch validation", "Confirm the release starts from the intended branch.", 0, "git.status", ["Observed branch is recorded"]],
    ["Working-tree validation", "Prove the exact source tree is deliberate.", 0, "git.status", ["Working tree state is recorded"]],
    ["Tests", "Run the complete automated test suite.", 2, "task.process.start", ["Exit code is zero", "Test totals are recorded"]],
    ["Lint", "Run static lint validation.", 2, "task.process.start", ["Exit code is zero"]],
    ["Typecheck", "Run the TypeScript compiler without emitting.", 2, "task.process.start", ["Exit code is zero"]],
    ["Production build", "Build production Electron bundles.", 2, "task.process.start", ["Exit code is zero", "Bundles exist"]],
    ["ARM64 package", "Create the ARM64 macOS package.", 2, "task.process.start", ["DMG and ZIP artifacts exist"]],
    ["Universal package", "Create the universal macOS package.", 2, "task.process.start", ["Universal DMG and ZIP artifacts exist"]],
    ["Commit", "Commit the exact validated staged source set.", 2, "git.commit", ["Commit SHA is recorded"]],
    ["Push", "Push the validated feature branch.", 2, "git.push", ["Remote branch contains commit"]],
    ["Pull request", "Create or identify the release pull request.", 2, "web.open", ["Pull request ID and URL are recorded"]],
    ["Merge", "Merge only after required checks pass.", 2, "web.open", ["Merge commit is recorded"]],
    ["Main synchronization", "Verify local main equals origin/main.", 2, "git.pull", ["Local and remote main SHAs match"]],
    ["Tag creation", "Create the annotated release tag at the authoritative commit.", 2, "shell.run", ["Annotated tag resolves to source commit"]],
    ["GitHub Actions", "Observe the release workflow without wasteful polling.", 0, "web.fetch", ["Workflow run ID and conclusion are recorded"]],
    ["DMG upload", "Upload the validated DMG serially.", 2, "web.open", ["Remote DMG exists"]],
    ["ZIP upload", "Upload the validated ZIP after the DMG.", 2, "web.open", ["Remote ZIP exists"]],
    ["Blockmap verification", "Verify expected blockmap assets.", 0, "web.fetch", ["Required blockmaps exist"]],
    ["Updater metadata verification", "Validate beta or latest updater YAML.", 0, "web.fetch", ["Updater metadata references correct assets"]],
    ["Remote SHA verification", "Compare remote assets with validated local hashes.", 0, "web.fetch", ["Every remote SHA matches"]],
    ["Release publication", "Publish the release only after provenance checks.", 2, "web.open", ["Release is published and not draft"]],
    ["Local installation", "Install the exact validated application package.", 2, "shell.run", ["Installed bundle identity is recorded"]],
    ["Runtime diagnostics", "Verify packaged runtime identity and security diagnostics.", 0, "terminal.read", ["Runtime diagnostics match the release"]],
    ["Updater verification", "Verify the selected logical update channel behavior.", 2, "shell.run", ["Updater result is recorded"]],
    ["Final handoff", "Generate the authoritative incomplete-or-complete release handoff.", 1, "task.handoff", ["Handoff Markdown exists"]]
  ];
  const steps = specifications.map(
    ([name, purpose, riskTier, requiredTool, verificationCriteria], index) => ({
      id: `release-${String(index + 1).padStart(2, "0")}-${slug(name)}`,
      name,
      purpose,
      riskTier,
      requiredTool,
      expectedInput: requiredTool === "task.process.start" ? {
        command: "defined when the task step is executed",
        args: []
      } : void 0,
      expectedOutput: {
        verified: true
      },
      retryPolicy: {
        maxAttempts: riskTier === 0 ? 2 : 1,
        backoffMs: 5e3,
        retryableErrorCodes: ["ETIMEDOUT", "ECONNRESET", "HTTP_502"]
      },
      timeoutMs: requiredTool === "task.process.start" ? 6e5 : 12e4,
      artifactPaths: [],
      verificationCriteria,
      dependencies: index ? [
        `release-${String(index).padStart(2, "0")}-${slug(
          specifications[index - 1][0]
        )}`
      ] : [],
      rollbackInstructions: riskTier === 2 ? "Inspect the exact tool result and remote/local state before attempting any rollback." : void 0
    })
  );
  return {
    title: `Release FORGE ${version}`,
    description: "Workspace-owned release workflow. The template defines structure and verification; it grants no execution authority.",
    taskType: "release",
    priority: "high",
    originatingConversationId,
    progressSummary: "Release workflow drafted; no executable step has started.",
    resumeInstructions: "Reconcile Git, local processes, workflow/release metadata, asset presence, and hashes. Continue only from the first genuinely unfinished step. Do not rebuild, retag, reupload, recreate a pull request, or republish verified work.",
    associatedReleaseTag: `v${version}`,
    steps
  };
}
function taskHandoffMarkdown(task) {
  const complete = task.steps.filter(completed);
  const current = task.steps.find((step) => step.id === task.currentStepId);
  const waiting = task.steps.filter((step) => step.status === "waiting");
  const blocked = task.steps.filter((step) => ["blocked", "failed"].includes(step.status));
  const lines = [`# ${task.title}`, "", `Task ID: \`${task.id}\``, `Status: **${task.status}**`, `Updated: ${new Date(task.updatedAt).toISOString()}`, "", "## Objective", "", task.description ?? task.title, "", "## Completed steps", "", ...complete.length ? complete.map((step) => `- [x] ${step.name}`) : ["- None verified yet."], "", "## Current state", "", `- Current step: ${current?.name ?? "None"}`, `- Progress: ${task.progressSummary}`, `- Waiting: ${waiting.map((step) => step.name).join(", ") || "None"}`, `- Blockers: ${blocked.map((step) => `${step.name}: ${step.lastError?.message ?? step.status}`).join("; ") || "None"}`, `- Active process IDs: ${task.processIds.join(", ") || "None"}`, "", "## Provenance and external state", "", `- Branch: ${task.associatedBranch ?? "Unrecorded"}`, `- Commit: ${task.associatedCommitSha ?? "Unrecorded"}`, `- Pull request: ${task.associatedPullRequest ?? "Unrecorded"}`, `- Tag: ${task.associatedReleaseTag ?? "Unrecorded"}`, `- Workflow run: ${task.associatedWorkflowRun ?? "Unrecorded"}`, ...task.externalReferences.map((reference) => `- ${reference.type}: ${reference.url ?? reference.externalId} (${reference.state ?? "state unrecorded"})`), "", "## Artifacts and verification", "", ...task.artifacts.length ? task.artifacts.map((artifact) => `- ${artifact.kind}: ${artifact.path ?? artifact.uri ?? artifact.id}${artifact.sha256 ? ` — SHA-256 ${artifact.sha256}` : ""}${artifact.verifiedAt ? " (verified)" : ""}`) : ["- No artifacts recorded."], ...task.checkpoints.map((checkpoint) => `- ${checkpoint.verified ? "Verified" : "Unverified"} checkpoint: ${checkpoint.name} — ${checkpoint.summary}`), "", "## Resume instructions", "", task.resumeInstructions, "", "## Next action", "", current ? `Reconcile and advance **${current.name}** only after its dependencies and verification criteria are satisfied.` : "Reconcile the task and identify the first genuinely unfinished step.", "", "## Actions that must not be repeated", "", ...complete.length ? complete.map((step) => `- Do not repeat ${step.name} unless current evidence invalidates its verified checkpoint.`) : ["- No completed action is yet protected from repetition."], "", "> SQLite task state in `.forge/metadata.sqlite` is authoritative. This Markdown file is a human-readable projection.", ""];
  return lines.join("\n");
}
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "taskContext").sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, stableValue(entry)]));
}
function toolCallKey(call) {
  return `${call.name}:${JSON.stringify(stableValue(call.arguments))}`;
}
class ProgressAwareLoopGuard {
  observations = /* @__PURE__ */ new Map();
  shouldRun(call, revision) {
    return this.observations.get(toolCallKey(call))?.revision !== revision;
  }
  record(call, revision, result) {
    this.observations.set(toolCallKey(call), { revision, result: JSON.stringify(result).slice(0, 16e3) });
  }
  observedResults() {
    return [...this.observations.values()].map((entry) => entry.result);
  }
}
function directTaskLink(input) {
  const link = input;
  return typeof link?.taskId === "string" && typeof link.stepId === "string" ? { taskId: link.taskId, stepId: link.stepId } : null;
}
function taskEvidenceLink(request) {
  return directTaskLink(request.executionContext) ?? (request.toolName === "task.process.start" ? directTaskLink(request.input) : null);
}
function requiredDirectEvidence(prompt, observedTools) {
  const normalized = prompt.toLowerCase();
  const observed = new Set(observedTools);
  const required2 = /* @__PURE__ */ new Set();
  if (/\bfile\.search\b/.test(normalized)) required2.add("file.search");
  if (/\bfile\.read\b|\bread (?:this|the|that|a) file\b|\bread\s+(?:`[^`]+`|[\w./-]+\.[a-z0-9]{1,12})\b/.test(normalized)) required2.add("file.read");
  if (/\bgit\.log\b|\bgit (?:history|log)\b/.test(normalized)) required2.add("git.log");
  if (/\bgit\.diff\b|\b(?:current|git|staged) diff\b/.test(normalized)) required2.add("git.diff");
  if (/\bgit\.status\b|\bgit status\b/.test(normalized)) required2.add("git.status");
  if (/\b(?:use|using) (?:agent |workspace )?tools? to inspect (?:the )?(?:workspace|repository|source)|\binspect (?:the )?(?:workspace|repository) with (?:agent |workspace )?tools?\b/.test(normalized)) required2.add("file.search");
  const investigation = /\b(?:diagnos\w*|debug\w*|investigat\w*|regression|bug|crash|failure|root cause)\b/.test(normalized);
  if (investigation) required2.add("file.search");
  if (investigation && observed.has("file.search")) required2.add("file.read");
  if (/\b(?:regression|introduced|when (?:did|was)|git boundary)\b/.test(normalized)) required2.add("git.log");
  return [...required2].filter((toolName) => !observed.has(toolName));
}
function assertToolIdentity(request, result, conversationId) {
  if (!request?.id || !request?.toolName) throw new Error("FORGE tool routing returned an incomplete request identity.");
  if (request.conversationId !== conversationId) throw new Error(`FORGE tool request conversation mismatch: expected ${conversationId}, received ${String(request.conversationId)}.`);
  if (!result) return;
  if (result.requestId !== request.id) throw new Error(`FORGE tool result request mismatch: expected ${request.id}, received ${String(result.requestId)}.`);
  if (result.toolName !== request.toolName) throw new Error(`FORGE tool result name mismatch: expected ${request.toolName}, received ${String(result.toolName)}.`);
}
function runtimeToolRecoveryGuidance(toolName, errorMessage, availableTools) {
  const message = errorMessage.toLowerCase();
  const catalog = [...availableTools].sort().join(", ");
  const guidance = [`Runtime tool catalog: ${catalog || "(none)"}.`, `The failed ${toolName} invocation does not mean the tool is unavailable; distinguish argument, policy, and execution failures from capability absence.`];
  if (/SCOPE_FAILURE/i.test(errorMessage)) guidance.push("The resolved target is outside the configured filesystem scope. Preserve the observed path and tell the user which broader scope to select in Settings; do not repeat the same request or claim the file tool is unavailable.");
  else if (/workspace-relative|traverse upward|escapes? (?:the )?(?:active )?workspace|absolute paths? require/i.test(errorMessage)) guidance.push("File tools accept relative, parent, home, and absolute paths when permitted by the configured filesystem scope. The operating system may still deny access.");
  if (/POLICY_FAILURE/i.test(errorMessage)) guidance.push("The operation is blocked by the current execution or network policy. State the exact setting that must be enabled; do not retry unchanged.");
  if (/eacces|eperm|permission denied|scandir/.test(message)) guidance.push("Report unreadable paths and continue where possible. On macOS, the user may need to grant the installed FORGE app Full Disk Access in System Settings; administrator-owned paths may also require elevation. Do not chmod/chown unrelated paths merely to satisfy indexing.");
  if (toolName.startsWith("browser.") && availableTools.has("browser.read")) guidance.push("browser.read/browser.find operate on the currently visible FORGE Browser page; do not infer that browser context is absent merely because a filesystem lookup failed.");
  if (toolName.startsWith("terminal.") && availableTools.has("terminal.read")) guidance.push("terminal.read reads existing FORGE terminal sessions and is separate from workspace file traversal.");
  return guidance.join(" ");
}
function createNativeAgentRuntime(dependencies) {
  const { storage: storage2, workspace: workspace2, agent: agent2, toolRouter: toolRouter2, taskRuntime: taskRuntime2, settings: settings2, aiProvider: aiProvider2, git: git2, emitRuntimeEvent: emitRuntimeEvent2, resolveReasoningRuntime: resolveReasoningRuntime2 } = dependencies;
  const maxRuntimeMs = Math.min(Math.max(Number(process.env.FORGE_AGENT_MAX_RUNTIME_MS) || 15 * 6e4, 6e4), 60 * 6e4);
  const historyFor = async (conversationId) => (await storage2.listConversationMessages(conversationId)).map((entry) => ({ role: entry.role, content: entry.content }));
  const recordTaskOutcome = async (request, result) => {
    const link = taskEvidenceLink(request);
    if (!link) return null;
    try {
      await taskRuntime2.recordToolOutcome(link.taskId, link.stepId, request.id, result);
      return null;
    } catch (error) {
      return `Task checkpoint link failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  };
  const runAgentTurn = async (conversationId, prompt, executionTask) => {
    const operationId = randomUUID();
    const operation = { operationId, conversationId, taskId: executionTask?.taskId, stepId: executionTask?.stepId };
    await emitRuntimeEvent2?.("agent.started", operation);
    try {
      const selectedRuntime = resolveReasoningRuntime2 ? await resolveReasoningRuntime2() : { agent: agent2, provider: aiProvider2, kind: "native" };
      const activeAgent = selectedRuntime.agent;
      const activeProvider = selectedRuntime.provider;
      const state = await storage2.conversationState(conversationId);
      const history = await historyFor(state.activeConversationId);
      await storage2.appendConversation(state.activeConversationId, "user", prompt);
      const project = await storage2.dashboard();
      const info = workspace2.info();
      if (!project || !info) throw new Error("Open a workspace before requesting agent tools.");
      const currentSettings = settings2.publicSettings();
      const definitions = toolRouter2.providerDefinitions(currentSettings.agentExecutionMode);
      const availableTools = new Set(definitions.map((definition2) => definition2.name));
      const capabilityCatalog = [...availableTools].sort().join(", ");
      let turn = await activeAgent.askWithTools(prompt, history, definitions);
      const outcomes = [];
      const successfulEvidence = () => outcomes.filter((outcome) => outcome.result?.success && !outcome.result.output?.missing && !outcome.result.output?.unreadable).map((outcome) => outcome.request.toolName);
      const runtimeFailures = [];
      const semanticRecordIds = /* @__PURE__ */ new Set();
      const rememberSemanticContext = (context) => {
        for (const artifact of context?.artifacts ?? []) if (typeof artifact.metadata?.semanticRecordId === "string") semanticRecordIds.add(artifact.metadata.semanticRecordId);
      };
      rememberSemanticContext(turn.context);
      const continuationHistory = [...history, { role: "user", content: prompt }];
      const loopGuard = new ProgressAwareLoopGuard();
      const workspaceRevision = async () => {
        try {
          const status = await git2.status();
          return JSON.stringify({ head: status.head?.hash ?? null, branch: status.branch, files: status.files.map((file) => [file.path, file.indexStatus, file.workingStatus]) });
        } catch {
          return "workspace-state-unavailable";
        }
      };
      const startedAt = Date.now();
      let modelContent = "";
      let evidenceNudges = 0;
      while (true) {
        if (Date.now() - startedAt > maxRuntimeMs) throw new Error(`Agent execution exceeded the configured ${Math.round(maxRuntimeMs / 6e4)} minute runtime budget. Progress and tool evidence were preserved for task resumption.`);
        const calls = [...turn.toolCalls];
        const fallback = calls.length ? null : parseStructuredToolFallback(activeProvider.id, turn.content);
        if (fallback) calls.push(fallback);
        if (!calls.length) {
          const missingEvidence = requiredDirectEvidence(prompt, successfulEvidence());
          if (missingEvidence.length && evidenceNudges < 3) {
            evidenceNudges += 1;
            continuationHistory.push({ role: "assistant", content: turn.content || "I have not yet gathered the explicitly requested workspace evidence." });
            turn = await activeAgent.askWithTools(`The original request explicitly requires direct current evidence. Request these missing read-only FORGE tools now: ${missingEvidence.join(", ")}. Do not answer from semantic context or memory. For an investigation, file.search is discovery only: follow it with file.read of the relevant implementation, then trace callers, tests, and Git evidence as needed.`, continuationHistory, definitions);
            rememberSemanticContext(turn.context);
            continue;
          }
          if (missingEvidence.length) throw new Error(`The active reasoning provider did not request required direct evidence after ${evidenceNudges} recovery attempts: ${missingEvidence.join(", ")}.`);
          modelContent = turn.content;
          break;
        }
        const revision = await workspaceRevision();
        const fresh = calls.filter((call) => loopGuard.shouldRun(call, revision));
        if (!fresh.length) {
          const missingEvidence = requiredDirectEvidence(prompt, successfulEvidence());
          if (missingEvidence.length && evidenceNudges < 3) {
            evidenceNudges += 1;
            const evidence3 = loopGuard.observedResults().join("\n\n");
            continuationHistory.push({ role: "assistant", content: turn.content || "I repeated a tool call without satisfying the requested evidence." });
            turn = await activeAgent.askWithTools(`The repeated tool call did not satisfy the original request. Request a different, valid call for these missing read-only FORGE tools: ${missingEvidence.join(", ")}. A tool only counts as evidence after it succeeds. Do not answer from semantic context or memory.

Observed results:
${evidence3}`, continuationHistory, definitions);
            rememberSemanticContext(turn.context);
            continue;
          }
          if (missingEvidence.length) throw new Error(`The active reasoning provider did not produce successful required evidence after ${evidenceNudges} recovery attempts: ${missingEvidence.join(", ")}.`);
          const evidence2 = loopGuard.observedResults().join("\n\n");
          modelContent = (await activeAgent.askWithContext(`Every requested tool call would repeat the same normalized arguments against the same workspace state. Do not request another tool. Complete the response from these observed results. A failed invocation is not evidence that the tool itself is unavailable. Available runtime tools: ${capabilityCatalog}.

${evidence2}`, continuationHistory)).content;
          break;
        }
        const round = [];
        const validationEvidence = [];
        for (const call of fresh) {
          if (executionTask) {
            const currentTask = await taskRuntime2.get(executionTask.taskId);
            if (["paused", "cancelled", "completed"].includes(currentTask.status)) {
              validationEvidence.push(JSON.stringify({ type: currentTask.status === "paused" ? "PAUSED" : "CANCELLATION", tool: call.name, message: `Tool launch suppressed because task state is ${currentTask.status}.` }));
              break;
            }
          }
          const toolOperationId = call.id || randomUUID();
          let requestId = call.id;
          let succeeded = false;
          await emitRuntimeEvent2?.("tool.requested", { operationId: toolOperationId, toolName: call.name, conversationId: state.activeConversationId, taskId: executionTask?.taskId, stepId: executionTask?.stepId });
          try {
            const outcome = await toolRouter2.request(call, { workspaceId: project.id, workspaceRoot: info.rootPath, repositoryRoot: info.gitRoot ?? void 0, filesystemScope: currentSettings.filesystemScope, projectTreeRoot: currentSettings.projectTreeRoot || void 0, executionMode: currentSettings.agentExecutionMode, networkAccess: currentSettings.networkAccess, backgroundTasksEnabled: currentSettings.backgroundTasksEnabled, autoRepairToolArguments: currentSettings.autoRepairToolArguments, processMode: currentSettings.processMode, processTimeoutMs: currentSettings.processTimeoutMs, backgroundTaskTimeoutMs: currentSettings.backgroundTaskTimeoutMs, conversationId: state.activeConversationId, modelId: turn.modelId ?? currentSettings.apiModel, userRequest: prompt, task: executionTask });
            assertToolIdentity(outcome.request, outcome.result, state.activeConversationId);
            requestId = outcome.request.id;
            succeeded = outcome.result?.success ?? false;
            round.push(outcome);
            outcomes.push(outcome);
            loopGuard.record(call, await workspaceRevision(), { success: outcome.result?.success, affectedPaths: outcome.result?.affectedPaths, exitCode: outcome.result?.exitCode, error: outcome.result?.error, output: outcome.result?.output });
            if (outcome.result) await recordTaskOutcome(outcome.request, outcome.result);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const guidance = runtimeToolRecoveryGuidance(call.name, message, availableTools);
            const errorCode2 = typeof error === "object" && error && "code" in error ? String(error.code) : /SCOPE_FAILURE/.test(message) ? "SCOPE_FAILURE" : /POLICY_FAILURE/.test(message) ? "POLICY_FAILURE" : "EXECUTION_FAILURE";
            let normalizedArguments;
            try {
              normalizedArguments = normalizeProviderToolCall(call, prompt).arguments;
            } catch {
              normalizedArguments = call.arguments;
            }
            validationEvidence.push(JSON.stringify({ type: errorCode2, tool: call.name, originalArguments: sanitizeToolData(call.arguments), normalizedArguments: sanitizeToolData(normalizedArguments), repairAttempted: JSON.stringify(call.arguments) !== JSON.stringify(normalizedArguments), recoverable: errorCode2 === "MALFORMED_ARGUMENTS", message, recovery: guidance }, null, 2));
            runtimeFailures.push(`Tool ${call.name} routing failed: ${message}`);
            loopGuard.record(call, await workspaceRevision(), { success: false, error: { code: "TOOL_ROUTING_FAILED", message }, output: { recovery: guidance } });
          } finally {
            await emitRuntimeEvent2?.("tool.completed", { operationId: toolOperationId, toolName: call.name, requestId, success: succeeded, conversationId: state.activeConversationId, taskId: executionTask?.taskId, stepId: executionTask?.stepId });
          }
        }
        const resultEvidence = round.filter((outcome) => outcome.result).map((outcome) => {
          const result = outcome.result;
          const bounded2 = boundedToolEvidence(result);
          return result.success ? bounded2 : `${bounded2}
Recovery guidance: ${runtimeToolRecoveryGuidance(result.toolName, result.error?.message ?? "Tool execution failed.", availableTools)}`;
        });
        const evidence = [...resultEvidence, ...validationEvidence].join("\n\n");
        const redirects = executionTask ? await taskRuntime2.pendingRedirects(executionTask.taskId) : [];
        const taskState = executionTask ? await taskRuntime2.get(executionTask.taskId) : void 0;
        if (taskState && ["paused", "cancelled", "completed"].includes(taskState.status)) {
          modelContent = `Agent continuation stopped because task state is ${taskState.status}.`;
          break;
        }
        continuationHistory.push({ role: "assistant", content: turn.content || "I requested FORGE tools." });
        const redirectText = redirects.length ? `

New task instructions from the user; apply them from this safe boundary:
${redirects.map((entry) => `- ${entry.instruction}`).join("\n")}` : "";
        turn = await activeAgent.askWithTools(`Continue the original request using these bounded Tool Result records. Do not repeat completed tool calls. Do not claim a tool is missing when it appears in the runtime catalog. file.* paths are governed by the configured filesystem scope. A failed path or call is not proof that other tools are absent. Correct malformed arguments and retry with a valid call when useful. Runtime tool catalog for this turn: ${capabilityCatalog}. FORGE supplies execution identity and audit context internally.${redirectText}

${evidence}`, continuationHistory, definitions);
        if (executionTask && redirects.length) await taskRuntime2.acknowledgeRedirects(executionTask.taskId, redirects.map((entry) => entry.eventId));
        rememberSemanticContext(turn.context);
      }
      const summary = [...outcomes.map(({ request, result }) => `Tool ${request.toolName} ${result?.success ? "succeeded" : "failed"}${result?.error ? `: ${result.error.message}` : ""}.`), ...runtimeFailures].join("\n");
      const content = [modelContent, summary].filter(Boolean).join("\n\n") || "FORGE received no response from the model.";
      await storage2.appendConversation(state.activeConversationId, "assistant", content);
      await storage2.markSemanticRecordsUsed([...semanticRecordIds], outcomes.length === 0 || outcomes.every((outcome) => outcome.result?.success));
      await emitRuntimeEvent2?.("agent.completed", { ...operation, conversationId: state.activeConversationId, toolCount: outcomes.length, routingFailureCount: runtimeFailures.length, runtime: selectedRuntime.kind });
      return { content, contextUsed: turn.context.artifacts.length > 0, conversationId: state.activeConversationId, memories: turn.memories.map((memory) => ({ id: memory.id, title: memory.title })), contextSources: turn.context.artifacts.map((artifact) => ({ id: artifact.id, kind: artifact.kind, title: artifact.title, path: artifact.path, relevance: artifact.metadata?.relevance, reason: artifact.metadata?.reason })), contextHealth: turn.context.metrics };
    } catch (error) {
      await emitRuntimeEvent2?.("agent.blocked", { ...operation, message: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  };
  const runTaskStep = async (taskId) => {
    let task = await taskRuntime2.resume(taskId);
    let advancedSteps = 0;
    while (task.status === "ready" && task.currentStepId && (advancedSteps === 0 || settings2.publicSettings().autonomousTaskContinuation)) {
      const step = task.steps.find((candidate) => candidate.id === task.currentStepId);
      if (!step) break;
      advancedSteps += 1;
      const priorStepId = step.id;
      const conversationId = task.lastActiveConversationId ?? task.originatingConversationId;
      await runAgentTurn(conversationId, `Start the dependency-ready task step now. Use the required tool without supplying runtime IDs or audit metadata. Do not only describe the plan. Task: ${task.title}. Step: ${step.name}. Purpose: ${step.purpose}. Expected input: ${JSON.stringify(step.expectedInput ?? {})}. Verification: ${step.verificationCriteria.join("; ")}. When the observed evidence satisfies every criterion, request task.checkpoint using only its semantic fields; FORGE attaches the active task, step, and audit identities.`, { taskId: task.id, stepId: step.id });
      const updated = await taskRuntime2.get(taskId);
      if (updated.status !== "ready" || !updated.currentStepId || updated.currentStepId === priorStepId) return updated;
      task = updated;
    }
    return task;
  };
  return { runAgentTurn, runTaskStep };
}
const TASK_MUTATIONS = [
  IPC_CHANNELS.tasksCreate,
  IPC_CHANNELS.tasksUpdate,
  IPC_CHANNELS.tasksCreateRelease,
  IPC_CHANNELS.tasksDelete,
  IPC_CHANNELS.tasksPause,
  IPC_CHANNELS.tasksResume,
  IPC_CHANNELS.tasksCancel,
  IPC_CHANNELS.tasksRedirect,
  IPC_CHANNELS.tasksRetryStep,
  IPC_CHANNELS.tasksHandoff
];
const MEMORY_MUTATIONS = [
  IPC_CHANNELS.agentMemoriesDelete,
  IPC_CHANNELS.agentMemoriesClear,
  IPC_CHANNELS.agentMemoriesReindex
];
const TERMINAL_LIFECYCLE_MUTATIONS = [
  IPC_CHANNELS.terminalCreate,
  IPC_CHANNELS.terminalTerminate,
  IPC_CHANNELS.terminalRestart,
  IPC_CHANNELS.terminalRemove
];
function eventForChannel(channel) {
  if (["file.write", "file.create", "file.delete", "file.rename", "file.copy"].includes(channel)) return "file.changed";
  if (["git.stage", "git.unstage", "git.commit", "git.pull", "git.push"].includes(channel)) return "git.changed";
  if (TASK_MUTATIONS.includes(channel)) return "task.changed";
  if (MEMORY_MUTATIONS.includes(channel)) return "memory.changed";
  if (TERMINAL_LIFECYCLE_MUTATIONS.includes(channel)) return "terminal.changed";
  if (channel === IPC_CHANNELS.workspaceOpen || channel === IPC_CHANNELS.workspaceOpenHome) return "workspace.changed";
  return null;
}
const execFileAsync = promisify(execFile$1);
const FIELD_CODE = /^%[fFuUdDnNickvm]$/;
function tokenizeExec(value) {
  const tokens = [];
  let token = "", quote = "", escaped = false;
  for (const character of value.trim()) {
    if (escaped) {
      token += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = "";
      else token += character;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      if (token) {
        tokens.push(token);
        token = "";
      }
      continue;
    }
    token += character;
  }
  if (escaped || quote) throw new Error("Malformed desktop Exec field.");
  if (token) tokens.push(token);
  return tokens;
}
function parseDesktopEntry(contents, desktopFile) {
  const values = /* @__PURE__ */ new Map();
  let section = "";
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("[") && line.endsWith("]")) {
      section = line.slice(1, -1);
      continue;
    }
    if (section !== "Desktop Entry") continue;
    const separator = line.indexOf("=");
    if (separator > 0) values.set(line.slice(0, separator), line.slice(separator + 1));
  }
  if (values.get("Type") !== "Application" || !values.get("Name") || !values.get("Exec")) return null;
  let tokens;
  try {
    tokens = tokenizeExec(values.get("Exec"));
  } catch {
    return null;
  }
  if (!tokens.length || tokens[0].includes("\0")) return null;
  const arguments_ = [];
  for (const token of tokens.slice(1)) {
    if (token === "%%") arguments_.push("%");
    else if (FIELD_CODE.test(token) || /%[fFuUdDnNickvm]/.test(token) || /^@@[fFuUdDnNickvm]?$/.test(token)) continue;
    else arguments_.push(token);
  }
  return { id: path__default.basename(desktopFile), name: values.get("Name"), genericName: values.get("GenericName"), description: values.get("Comment") ?? "", icon: values.get("Icon"), executable: tokens[0], arguments: arguments_, categories: (values.get("Categories") ?? "").split(";").filter(Boolean), desktopFile, terminal: values.get("Terminal") === "true", hidden: values.get("Hidden") === "true", noDisplay: values.get("NoDisplay") === "true", onlyShowIn: (values.get("OnlyShowIn") ?? "").split(";").filter(Boolean), notShowIn: (values.get("NotShowIn") ?? "").split(";").filter(Boolean), tryExec: values.get("TryExec"), startupWMClass: values.get("StartupWMClass"), dbusActivatable: values.get("DBusActivatable") === "true" };
}
function applicationDirectories(environment) {
  const dataHome = environment.XDG_DATA_HOME || path__default.posix.join(homedir(), ".local/share");
  return [dataHome, ...(environment.XDG_DATA_DIRS || "/usr/local/share:/usr/share").split(":").filter(Boolean)].map((directory) => path__default.posix.join(directory, "applications"));
}
function desktopVisible(application, environment) {
  if (application.hidden || application.noDisplay) return false;
  const desktops = (environment.XDG_CURRENT_DESKTOP || "").split(":").filter(Boolean);
  if (application.onlyShowIn.length && !application.onlyShowIn.some((desktop) => desktops.includes(desktop))) return false;
  if (application.notShowIn.some((desktop) => desktops.includes(desktop))) return false;
  return true;
}
function trustedInternalApplication(application) {
  if (!application.id.startsWith("forge-internal-") || application.desktopFile !== path__default.posix.join("/usr/share/applications", application.id)) return false;
  return ["/usr/local/bin/forge-system-surface", "/usr/local/bin/forge-session-control"].includes(application.executable);
}
class ForgeOsService {
  constructor(environment = process.env, operatingSystem = platform) {
    this.environment = environment;
    this.operatingSystem = operatingSystem;
  }
  applications = /* @__PURE__ */ new Map();
  context() {
    const currentPlatform = this.operatingSystem();
    const forgeOsSession = currentPlatform === "linux" && (this.environment.FORGE_OS_SESSION === "1" || this.environment.XDG_CURRENT_DESKTOP?.toUpperCase() === "FORGE");
    const recoveryMode = forgeOsSession && this.environment.FORGE_RECOVERY_MODE === "1";
    const liveRecoveryMode = recoveryMode && this.environment.FORGE_LIVE_RECOVERY === "1";
    return { platform: currentPlatform, forgeOsSession, shellMode: forgeOsSession && this.environment.FORGE_SHELL_MODE !== "0", sessionType: this.environment.XDG_SESSION_TYPE || "unknown", recoveryMode, liveRecoveryMode };
  }
  async discoverApplications() {
    const discovered = /* @__PURE__ */ new Map();
    for (const directory of applicationDirectories(this.environment)) for (const file of (await readdir(directory).catch(() => [])).filter((entry) => entry.endsWith(".desktop")).sort()) {
      if (discovered.has(file)) continue;
      const desktopFile = path__default.posix.join(directory, file);
      const parsed = parseDesktopEntry(await readFile(desktopFile, "utf8").catch(() => ""), desktopFile);
      if (parsed) discovered.set(file, parsed);
    }
    this.applications = discovered;
    return [...discovered.values()].filter((entry) => desktopVisible(entry, this.environment)).sort((a, b) => a.name.localeCompare(b.name));
  }
  async launchApplication(id2) {
    if (!this.context().shellMode) throw new Error("Application launch is available only in FORGE-OS shell mode.");
    if (!this.applications.size) await this.discoverApplications();
    const application = this.applications.get(id2);
    if (!application) throw new Error("Application is not available.");
    const trustedInternal = trustedInternalApplication(application);
    if ((application.hidden || application.noDisplay) && !trustedInternal) throw new Error("Application is not available.");
    const child = spawn(application.executable, application.arguments, { detached: true, stdio: "ignore", shell: false, env: this.environment });
    child.once("error", () => void 0);
    child.unref();
  }
  async overview(forgeVersion) {
    const osRelease = await readFile("/etc/os-release", "utf8").catch(() => "");
    const pretty = /^PRETTY_NAME=(?:"([^"]+)"|(.*))$/m.exec(osRelease);
    const cpu = (await readFile("/proc/cpuinfo", "utf8").catch(() => "")).match(/^model name\s*:\s*(.+)$/m)?.[1] ?? "Unknown";
    const disk = await statfs(homedir());
    return { hostname: hostname(), os: pretty?.[1] || pretty?.[2] || platform(), kernel: release(), cpu, memoryBytes: totalmem(), storage: { totalBytes: disk.blocks * disk.bsize, freeBytes: disk.bavail * disk.bsize }, forgeVersion, forgeOsVersion: this.environment.FORGE_OS_VERSION || "0.x development", sessionType: this.environment.XDG_SESSION_TYPE || "unknown" };
  }
  async sessionAction(action) {
    if (!this.context().shellMode) throw new Error("Session actions are available only in FORGE-OS shell mode.");
    const sessionId = this.environment.XDG_SESSION_ID;
    if (action === "lock") {
      await execFileAsync("loginctl", sessionId ? ["lock-session", sessionId] : ["lock-session"], { timeout: 1e4 });
      return;
    }
    if (action === "logout") {
      if (sessionId) await execFileAsync("loginctl", ["terminate-session", sessionId], { timeout: 1e4 });
      else await execFileAsync("systemctl", ["--user", "exit"], { timeout: 1e4 });
      return;
    }
    const systemAction = action === "restart" ? "reboot" : "poweroff";
    try {
      await execFileAsync("systemctl", [systemAction, "--no-block"], { timeout: 1e4 });
    } catch {
      await execFileAsync("pkexec", ["/usr/bin/systemctl", systemAction, "--no-block"], { timeout: 1e4 });
    }
  }
}
const execFile = promisify(execFile$1);
function normalizePlatform(value) {
  return ["linux", "darwin", "win32"].includes(value) ? value : "other";
}
function hermesIntegrationMode(platform2, status) {
  if (status?.availability !== "available") return "unavailable";
  return normalizePlatform(platform2) === "linux" ? "acp" : status.endpointReachable ? "headless-http" : "unavailable";
}
function platformCapabilities(input) {
  const platform2 = normalizePlatform(input.platform ?? process.platform);
  const mode = hermesIntegrationMode(platform2, input.hermesStatus);
  return { platform: platform2, nativeRuntimeAvailable: true, hermesAvailable: mode !== "unavailable", hermesIntegrationMode: mode, embeddingProviderAvailable: input.embeddingProviderAvailable, embeddingModelAvailable: input.embeddingModelAvailable, semanticIndexHealthy: input.semanticIndexHealthy, toolRouterAvailable: input.toolRouterAvailable !== false, workspaceDatabaseHealthy: input.workspaceDatabaseHealthy, appDataPath: path__default.resolve(input.appDataPath), packagedResourcePath: path__default.resolve(input.resourcePath) };
}
const exists = async (value) => access(value).then(() => true).catch(() => false);
class HermesRuntimeDetector {
  async status(options = {}) {
    const command = normalizeCommand(options.command) ?? "hermes";
    const environment = options.environment ?? process.env;
    const homeDirectory = options.homeDirectory ?? homedir();
    const configuredRoot = environment.HERMES_HOME?.trim();
    const endpoint = normalizeEndpoint(options.endpoint);
    const execute = options.execute ?? ((file, args, executionOptions) => execFile(file, args, executionOptions));
    const fetcher = options.fetcher ?? fetch;
    let version;
    let installDirectory;
    let executableError;
    const candidates = [];
    try {
      const result = await execute(command, ["--version"], { timeout: 4e3, windowsHide: true });
      version = firstUsefulLine(result.stdout) ?? firstUsefulLine(result.stderr);
      installDirectory = installedDirectory(result.stdout) ?? installedDirectory(result.stderr);
      if (installDirectory) candidates.push(path__default.dirname(installDirectory));
    } catch (error) {
      executableError = conciseError(error);
    }
    let endpointReachable = null;
    if (endpoint) {
      try {
        const response = await fetcher(endpoint, { method: "HEAD", signal: AbortSignal.timeout(4e3) });
        endpointReachable = response.ok || response.status === 401 || response.status === 403;
      } catch {
        endpointReachable = false;
      }
    }
    const roots = [...new Set([configuredRoot, ...candidates, path__default.join(homeDirectory, ".hermes")].filter((candidate) => Boolean(candidate && candidate.trim())))];
    const skillRoots = roots.flatMap((root) => [path__default.join(root, "skills"), path__default.join(root, "optional-skills")]);
    const discoveredRoots = (await Promise.all(skillRoots.map(async (candidate) => await exists(candidate) ? candidate : null))).filter((candidate) => Boolean(candidate));
    if (version) return {
      kind: "hermes",
      availability: endpointReachable === false ? "degraded" : "available",
      command,
      version,
      endpoint,
      endpointReachable,
      installDirectory,
      skillRoots: discoveredRoots,
      message: endpointReachable === false ? "Hermes CLI is available, but the configured endpoint did not respond." : "Hermes CLI is available. FORGE retains workspace state and tool execution."
    };
    if (endpointReachable) return {
      kind: "hermes",
      availability: "degraded",
      command,
      endpoint,
      endpointReachable,
      skillRoots: discoveredRoots,
      message: "The configured Hermes endpoint responded, but the local Hermes CLI was not found. FORGE will keep using the native runtime until a supported headless bridge is configured."
    };
    return {
      kind: "hermes",
      availability: "unavailable",
      command,
      endpoint,
      endpointReachable,
      skillRoots: discoveredRoots,
      message: `Hermes is optional and was not detected${executableError ? ` (${executableError})` : ""}. FORGE will use its native runtime.`
    };
  }
}
function resolveAgentRuntime(requested, status, bridgeAvailable = false) {
  const active = requested === "hermes" && status?.availability === "available" && bridgeAvailable ? "hermes" : "native";
  return { kind: active, requested, active, status };
}
async function discoverSkills(roots) {
  const discovered = [];
  for (const root of roots) await visit(root.path, root.scope, 0, discovered);
  return discovered.sort((left, right) => left.name.localeCompare(right.name) || left.path.localeCompare(right.path));
}
async function visit(directory, scope, depth, discovered) {
  if (depth > 4) return;
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const child = path__default.join(directory, entry.name);
    const skillFile = path__default.join(child, "SKILL.md");
    if (await exists(skillFile)) {
      const skill = parseSkillMetadata(await readFile(skillFile, "utf8").catch(() => ""), skillFile, scope);
      if (skill) discovered.push(skill);
      continue;
    }
    await visit(child, scope, depth + 1, discovered);
  }
}
function parseSkillMetadata(contents, skillPath, scope) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(contents)?.[1] ?? "";
  const field = (name2) => new RegExp(`^${name2}:\\s*(.+?)\\s*$`, "mi").exec(frontmatter)?.[1]?.trim().replace(/^['"]|['"]$/g, "");
  const title = /^#\s+(.+?)\s*$/m.exec(contents)?.[1]?.trim();
  const name = field("name") || title;
  if (!name) return null;
  const platforms = (field("platforms") ?? "").replace(/^\[|\]$/g, "").split(",").map((item) => item.trim()).filter(Boolean);
  return { id: `${scope}:${skillPath.replaceAll("\\", "/")}`, name, description: field("description") ?? "", version: field("version"), platforms, path: skillPath, scope };
}
function skillRootsForWorkspace(workspaceRoot, options = {}) {
  const platform$1 = options.platform ?? platform();
  return [
    { path: path__default.join(workspaceRoot, ".forge", "skills"), scope: "workspace" },
    { path: path__default.join(workspaceRoot, "skills"), scope: "repository" },
    ...(options.hermesRoots ?? []).map((skillRoot) => ({ path: skillRoot, scope: "global" })),
    ...platform$1 === "linux" ? [{ path: "/usr/share/forge/skills", scope: "forge-os" }] : []
  ];
}
function normalizeCommand(value) {
  const normalized = value?.trim();
  if (!normalized) return void 0;
  if (normalized.length > 1024 || /[\0\r\n]/.test(normalized)) throw new Error("Hermes command must be a bounded executable path or command name.");
  return normalized;
}
function normalizeEndpoint(value) {
  const normalized = value?.trim();
  if (!normalized) return void 0;
  const parsed = new URL(normalized);
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("Hermes endpoint must be an HTTP(S) URL without embedded credentials.");
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname.toLowerCase());
  if (parsed.protocol === "http:" && !loopback) throw new Error("Remote Hermes endpoints must use HTTPS.");
  return parsed.toString();
}
function firstUsefulLine(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).find(Boolean)?.slice(0, 300);
}
function installedDirectory(value) {
  return /^Install directory:\s*(.+?)\s*$/mi.exec(value)?.[1]?.trim();
}
function conciseError(error) {
  return (error instanceof Error ? error.message : String(error)).replace(/[\r\n]+/g, " ").slice(0, 180);
}
const workspace = new WorkspaceService();
const settings = new SettingsService();
const git = new GitService(() => settings.githubCredentials());
const github = new GitHubService(() => git.originUrl(), async () => {
  const credentials = await settings.githubCredentials();
  return credentials ? { token: credentials.token } : null;
});
const storage = new StorageService();
const updater = new UpdaterService();
const dirtyEditorPaths = /* @__PURE__ */ new Set();
const shellService = new ShellService(() => workspace.info()?.rootPath ?? null);
const webService = new WebService(() => settings.webResearchEnabled());
const terminalService = new TerminalService(() => workspace.info()?.rootPath ?? null, (event) => {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send("terminal.event", event);
});
const taskRuntime = new TaskRuntime({ storage, workspaceRoot: () => workspace.info()?.rootPath ?? null, git, shell: shellService });
const forgeOs = new ForgeOsService();
let mainWindow = null;
const browserTabs = /* @__PURE__ */ new Map();
let activeBrowserTabId = null;
let attachedBrowserView = null;
let browserLayout = { visible: false };
let browserBookmarks = [];
let browserHistory = [];
let rendererSource = "file:// development build";
let forgeLive = null;
const activeToolOperations = /* @__PURE__ */ new Set();
const activeTaskOperations = /* @__PURE__ */ new Set();
let lastToolActivityAt = 0;
let lastTaskActivityAt = 0;
function liveMainWindow() {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
}
function detachBrowserView() {
  const window = liveMainWindow();
  if (attachedBrowserView && window) {
    try {
      window.setBrowserView(null);
    } catch {
    }
  }
  attachedBrowserView = null;
}
function appBuildInfo() {
  return {
    ...buildReleaseIdentity(app.getVersion(), app.isPackaged),
    commit: "403d6f3731854466a1be0b7fb49d37192063c383",
    buildDate: "2026-09-28T13:59:33.843Z",
    runtime: app.isPackaged ? "packaged" : "development",
    rendererSource,
    platform: process.platform,
    architecture: process.arch
  };
}
const aiProvider = new OpenAIProvider();
const contextBuilder = new WorkspaceContextEngine(workspace, git, storage);
const intelligence = new WorkspaceIntelligenceService(contextBuilder, storage);
const embeddingClient = new OpenAICompatibleEmbeddingClient(() => settings.embeddingConfiguration(), (event) => emitRuntimeEvent(event.type, event.payload));
const semanticContext = new SemanticContextService(storage, embeddingClient, () => settings.embeddingConfiguration(), (event) => emitRuntimeEvent(event.type, event.payload), workspace);
const semanticIndexer = new SemanticIndexer(workspace, storage, embeddingClient, () => settings.embeddingConfiguration(), (event) => emitRuntimeEvent(event.type, event.payload));
async function runSemanticRefresh(operation, trigger) {
  try {
    let status = await operation();
    if (["degraded", "rebuild-required"].includes(status.state) && settings.publicSettings().autoRepairIndex) {
      await emitRuntimeEvent("semantic.index.start", { trigger, repair: true, priorState: status.state });
      status = await semanticIndexer.rebuild();
    }
    if (status.state === "degraded" || status.state === "rebuild-required") await emitRuntimeEvent("semantic.index.error", { trigger, state: status.state, message: status.lastError ?? "Semantic index requires repair." });
    else if (status.state === "ready") await emitRuntimeEvent("context.updated", { trigger, indexedRecords: status.indexedRecords });
  } catch (error) {
    await emitRuntimeEvent("semantic.index.error", { trigger, message: error instanceof Error ? error.message : String(error) });
  }
}
contextBuilder.useSemanticContext(semanticContext);
const memoryService = new MemoryService(storage);
const memoryRetriever = new MemoryRetriever(memoryService);
const memoryIndexer = new MemoryIndexer(memoryService, workspace);
const agent = new Agent(aiProvider, intelligence, memoryRetriever);
const hermesProvider = new OpenAIProvider();
hermesProvider.id = "hermes";
const hermesAgent = new Agent(hermesProvider, intelligence, memoryRetriever);
async function applyAISettings() {
  const inference = await settings.apiConfiguration();
  aiProvider.configure(inference);
  contextBuilder.setTokenBudget(settings.publicSettings().contextTokenBudget);
  const endpoint = settings.hermesConfiguration().endpoint;
  if (endpoint) hermesProvider.configure({ baseUrl: endpoint, model: inference.model });
}
async function resolveReasoningRuntime() {
  const publicSettings = settings.publicSettings();
  if (publicSettings.agentRuntime !== "hermes" || !publicSettings.hermesEndpoint) return { agent, provider: aiProvider, kind: "native" };
  const status = await new HermesRuntimeDetector().status(settings.hermesConfiguration());
  const profile = resolveAgentRuntime("hermes", status, status.endpointReachable === true);
  return profile.active === "hermes" ? { agent: hermesAgent, provider: hermesProvider, kind: "hermes" } : { agent, provider: aiProvider, kind: "native" };
}
async function emitRuntimeEvent(type, payload) {
  const operationId = typeof payload?.operationId === "string" ? payload.operationId : "";
  if (type === "tool.requested") {
    if (operationId) activeToolOperations.add(operationId);
    lastToolActivityAt = Date.now();
  }
  if (type === "tool.completed") {
    if (operationId) activeToolOperations.delete(operationId);
    lastToolActivityAt = Date.now();
  }
  if (type === "agent.started" && typeof payload?.taskId === "string") {
    activeTaskOperations.add(operationId || String(payload.taskId));
    lastTaskActivityAt = Date.now();
  }
  if (["agent.completed", "agent.blocked"].includes(type) && typeof payload?.taskId === "string") {
    activeTaskOperations.delete(operationId || String(payload.taskId));
    lastTaskActivityAt = Date.now();
  }
  if (type === "task.changed") lastTaskActivityAt = Date.now();
  if (type === "context.invalidated") await intelligence.invalidate(String(payload?.channel ?? "runtime-event"), payload);
  const workspaceId = (await storage.dashboard().catch(() => null))?.id;
  if (!workspaceId) return;
  const event = { type, workspaceId, occurredAt: Date.now(), payload };
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send("runtime.event", event);
}
function register(channel, action) {
  ipcMain.handle(channel, async (_event, request) => {
    try {
      const data = await action(request);
      const event = eventForChannel(channel);
      if (event) {
        await emitRuntimeEvent(event, { channel });
        await emitRuntimeEvent("context.invalidated", { channel });
        if (["task.changed", "memory.changed"].includes(event) && settings.publicSettings().embeddingEnabled && settings.publicSettings().autoIndex) void runSemanticRefresh(() => semanticIndexer.refreshDurableState(), `durable-state:${channel}`);
      }
      return { success: true, data };
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String(error.code) : void 0;
      const message = code === "EACCES" || code === "EPERM" ? process.platform === "darwin" ? "macOS denied access. Grant the installed FORGE app Full Disk Access in System Settings → Privacy & Security, then relaunch. Administrator-owned paths may still require separate elevation." : "The operating system denied access to that location. Check the file owner and permissions, then try again." : error instanceof Error ? error.message : "An unexpected error occurred.";
      return { success: false, error: { message, code } };
    }
  });
}
async function openWorkspaceAt(rootPath) {
  if (semanticRefreshTimer) clearTimeout(semanticRefreshTimer);
  semanticRefreshTimer = null;
  pendingSemanticPaths.clear();
  terminalService.dispose();
  dirtyEditorPaths.clear();
  activeToolOperations.clear();
  activeTaskOperations.clear();
  disposeBrowserTabs();
  await forgeLive?.stop().catch(() => void 0);
  forgeLive = null;
  await semanticIndexer.stop();
  await storage.close();
  const info = await workspace.open(rootPath);
  await git.init(info.rootPath);
  await storage.init(info.rootPath);
  await settings.rememberWorkspacePath(info.rootPath);
  workspace.watch();
  await refreshBrowserRecords();
  if (settings.publicSettings().embeddingEnabled && settings.publicSettings().autoIndex) void runSemanticRefresh(() => semanticIndexer.incremental(), "workspace-open");
  return info;
}
const pendingSemanticPaths = /* @__PURE__ */ new Set();
let semanticRefreshTimer = null;
workspace.on("changed", (relativePath2) => {
  void emitRuntimeEvent("file.changed", { path: relativePath2 });
  if (!settings.publicSettings().embeddingEnabled || !settings.publicSettings().autoIndex) return;
  pendingSemanticPaths.add(relativePath2);
  if (semanticRefreshTimer) clearTimeout(semanticRefreshTimer);
  semanticRefreshTimer = setTimeout(() => {
    semanticRefreshTimer = null;
    const paths = [...pendingSemanticPaths];
    pendingSemanticPaths.clear();
    void runSemanticRefresh(() => semanticIndexer.refreshPaths(paths), `file-change:${paths.length}`);
  }, 300);
});
function liveService() {
  const info = workspace.info();
  if (!info) throw new Error("Open a workspace before using FORGE Live.");
  if (!forgeLive || forgeLive.status().workspaceId !== info.rootPath) forgeLive = new ForgeLiveService(info.rootPath, { onState: (state) => {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send("forge-live.state", state);
  } });
  return forgeLive;
}
function browserState() {
  const active = activeBrowserTabId ? browserTabs.get(activeBrowserTabId) : void 0;
  const contents = active?.view.webContents;
  const tabs = [...browserTabs.values()].filter((tab) => !tab.view.webContents.isDestroyed()).map((tab) => ({
    id: tab.id,
    url: tab.view.webContents.getURL(),
    title: tab.view.webContents.getTitle() || tab.view.webContents.getURL() || "New tab",
    canGoBack: tab.view.webContents.canGoBack(),
    canGoForward: tab.view.webContents.canGoForward(),
    loading: tab.loading,
    error: tab.error || void 0
  }));
  return {
    url: contents?.getURL() ?? "",
    title: contents?.getTitle() ?? "",
    canGoBack: contents?.canGoBack() ?? false,
    canGoForward: contents?.canGoForward() ?? false,
    loading: active?.loading ?? false,
    error: active?.error || void 0,
    activeTabId: active?.id,
    showingHome: !active,
    tabs,
    bookmarks: browserBookmarks,
    history: browserHistory
  };
}
function sendBrowserState() {
  const window = liveMainWindow();
  if (window) window.webContents.send("browser.state", browserState());
}
async function refreshBrowserRecords() {
  if (!workspace.info()) {
    browserBookmarks = [];
    browserHistory = [];
    return;
  }
  [browserBookmarks, browserHistory] = await Promise.all([storage.listBrowserBookmarks(), storage.listBrowserHistory()]);
}
function activeBrowserTab() {
  const tab = activeBrowserTabId ? browserTabs.get(activeBrowserTabId) : void 0;
  return tab && !tab.view.webContents.isDestroyed() ? tab : null;
}
function blockedBrowserNavigation(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return "The browser rejected an invalid navigation URL.";
  }
  if (!["https:", "http:"].includes(url.protocol)) return "Only HTTP and HTTPS browser navigation is allowed.";
  if (url.username || url.password) return "Credential-bearing URLs are blocked.";
  const hostname2 = url.hostname.toLowerCase();
  if (isLoopbackUrl(value)) return null;
  if (hostname2 === "localhost" || hostname2.endsWith(".localhost") || hostname2.endsWith(".local")) return "Local-network URLs are blocked.";
  const ipv4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(hostname2);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a >= 224) return "Private and local network addresses are blocked.";
  }
  return null;
}
function createBrowserTab() {
  const tab = { id: randomUUID(), view: new BrowserView({ webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } }), loading: false, error: "" };
  const contents = tab.view.webContents;
  contents.setWindowOpenHandler(({ url }) => {
    void navigateBrowser(url, true).catch((error) => reportBrowserError(tab, error));
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, url) => {
    const reason2 = blockedBrowserNavigation(url);
    if (!reason2) return;
    event.preventDefault();
    reportBrowserError(tab, reason2);
  });
  contents.on("did-start-loading", () => {
    tab.loading = true;
    tab.error = "";
    sendBrowserState();
  });
  contents.on("did-finish-load", () => {
    tab.loading = false;
    sendBrowserState();
    const url = contents.getURL();
    if (url) void storage.recordBrowserVisit(url, contents.getTitle()).then(refreshBrowserRecords).then(sendBrowserState).catch(() => void 0);
  });
  contents.on("did-fail-load", (_event, errorCode2, errorDescription, validatedUrl, isMainFrame) => {
    if (isMainFrame && errorCode2 !== -3) reportBrowserError(tab, `${errorDescription} (${validatedUrl})`);
  });
  contents.on("did-navigate", sendBrowserState);
  contents.on("did-navigate-in-page", sendBrowserState);
  browserTabs.set(tab.id, tab);
  setBrowserLayout(browserLayout);
  return tab;
}
async function navigateBrowser(value, openInNewTab = false) {
  const url = (isLoopbackUrl(value) ? new URL(value) : await validateExternalUrl(value)).toString();
  const tab = openInNewTab ? createBrowserTab() : activeBrowserTab() ?? createBrowserTab();
  activeBrowserTabId = tab.id;
  tab.loading = true;
  tab.error = "";
  setBrowserLayout(browserLayout);
  sendBrowserState();
  try {
    await tab.view.webContents.loadURL(url);
  } catch (error) {
    if (!/ERR_ABORTED|\(-3\)/i.test(error instanceof Error ? error.message : String(error))) {
      reportBrowserError(tab, error);
      throw error;
    }
  }
  return browserState();
}
function reportBrowserError(tab, error) {
  tab.loading = false;
  tab.error = error instanceof Error ? error.message : String(error);
  sendBrowserState();
}
async function readBrowserPage() {
  const tab = activeBrowserTab();
  if (!tab) throw new Error("Open a public page in the FORGE Browser before asking the agent to read it.");
  const url = (await validateExternalUrl(tab.view.webContents.getURL())).toString();
  const document = await tab.view.webContents.executeJavaScript(`(() => ({ title: document.title || '', text: (document.body?.innerText || '').replace(/\\s+/g, ' ').trim() }))()`, true);
  const text = typeof document.text === "string" ? document.text : "";
  const limit = 16e4;
  return { url, title: typeof document.title === "string" ? document.title : tab.view.webContents.getTitle(), text: text.slice(0, limit), truncated: text.length > limit };
}
function setBrowserLayout(request) {
  browserLayout = request;
  const tab = activeBrowserTab();
  if (!request.visible || !tab) {
    detachBrowserView();
    return;
  }
  if (request.bounds) {
    const { x, y, width, height } = request.bounds;
    tab.view.setBounds({ x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)), width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) });
  }
  if (attachedBrowserView !== tab.view) {
    const window = liveMainWindow();
    if (!window) return;
    try {
      window.setBrowserView(tab.view);
      attachedBrowserView = tab.view;
    } catch {
      attachedBrowserView = null;
    }
  }
}
function showBrowserHome() {
  activeBrowserTabId = null;
  setBrowserLayout(browserLayout);
  sendBrowserState();
  return browserState();
}
function openBlankBrowserTab() {
  const tab = createBrowserTab();
  activeBrowserTabId = tab.id;
  tab.view.webContents.loadURL("about:blank").catch((error) => reportBrowserError(tab, error));
  setBrowserLayout(browserLayout);
  sendBrowserState();
  return browserState();
}
function selectBrowserTab(tabId) {
  if (!browserTabs.has(tabId)) throw new Error("The browser tab is no longer available.");
  activeBrowserTabId = tabId;
  setBrowserLayout(browserLayout);
  sendBrowserState();
  return browserState();
}
function closeBrowserTab(tabId) {
  const tab = browserTabs.get(tabId);
  if (!tab) return browserState();
  const ordered = [...browserTabs.keys()];
  const index = ordered.indexOf(tabId);
  browserTabs.delete(tabId);
  if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close();
  if (activeBrowserTabId === tabId) activeBrowserTabId = ordered[index + 1] ?? ordered[index - 1] ?? null;
  setBrowserLayout(browserLayout);
  sendBrowserState();
  return browserState();
}
async function addActiveBrowserBookmark() {
  const tab = activeBrowserTab();
  if (!tab) throw new Error("Open a public page before creating a bookmark.");
  const url = (await validateExternalUrl(tab.view.webContents.getURL())).toString();
  await storage.addBrowserBookmark(url, tab.view.webContents.getTitle());
  await refreshBrowserRecords();
  sendBrowserState();
  return browserState();
}
async function removeBrowserBookmark(bookmarkId) {
  await storage.deleteBrowserBookmark(bookmarkId);
  await refreshBrowserRecords();
  sendBrowserState();
  return browserState();
}
function disposeBrowserTabs() {
  detachBrowserView();
  for (const tab of browserTabs.values()) if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close();
  browserTabs.clear();
  activeBrowserTabId = null;
  browserBookmarks = [];
  browserHistory = [];
}
const browserToolService = {
  enabled: () => settings.webResearchEnabled(),
  open: navigateBrowser,
  read: readBrowserPage
};
const toolRouter = new ToolRouter({ git, github, shell: shellService, terminal: terminalService, tasks: taskRuntime, browser: browserToolService, memories: memoryService, web: webService, audit: storage, dirtyPaths: () => dirtyEditorPaths });
function registerHandlers() {
  register(IPC_CHANNELS.workspaceOpen, async () => {
    const selection = await dialog.showOpenDialog({ title: "Open Forge workspace", properties: ["openDirectory", "createDirectory"] });
    if (selection.canceled || !selection.filePaths[0]) throw new Error("Workspace selection was cancelled.");
    return openWorkspaceAt(selection.filePaths[0]);
  });
  register(IPC_CHANNELS.workspaceOpenHome, async () => openWorkspaceAt(homedir()));
  register(IPC_CHANNELS.workspaceInfo, async () => workspace.info());
  register(IPC_CHANNELS.workspaceLayoutGet, async () => storage.getWorkspaceLayout());
  register(IPC_CHANNELS.workspaceLayoutSave, async (request) => storage.saveWorkspaceLayout(request));
  register(IPC_CHANNELS.fileList, async (request) => workspace.list(request?.path, { recursive: request?.recursive, showHidden: request?.showHidden }));
  register(IPC_CHANNELS.fileRead, async (request) => workspace.readFile(request.path));
  register(IPC_CHANNELS.fileMetadata, async (request) => workspace.metadata(request.path));
  register(IPC_CHANNELS.filePreview, async (request) => workspace.preview(request.path));
  register(IPC_CHANNELS.fileWrite, async (request) => workspace.writeFile(request.path, request.content));
  register(IPC_CHANNELS.fileCreate, async (request) => workspace.create(request.path, request.type, request.content));
  register(IPC_CHANNELS.fileDelete, async (request) => workspace.delete(request.path));
  register(IPC_CHANNELS.fileRename, async (request) => workspace.rename(request.oldPath, request.newPath));
  register(IPC_CHANNELS.fileCopy, async (request) => workspace.copy(request.sourcePath, request.destinationPath));
  register(IPC_CHANNELS.markdownParse, async (request) => workspace.parse(request.path));
  register(IPC_CHANNELS.gitStatus, async () => git.status());
  register(IPC_CHANNELS.gitBranches, async () => git.branches());
  register(IPC_CHANNELS.gitLog, async (request) => git.log(request?.limit));
  register(IPC_CHANNELS.gitDiff, async (request) => git.diff(request.staged));
  register(IPC_CHANNELS.gitStage, async (request) => git.stage(request.files));
  register(IPC_CHANNELS.gitUnstage, async (request) => git.unstage(request.files));
  register(IPC_CHANNELS.gitCommit, async (request) => git.commit(request.message, request.files));
  register(IPC_CHANNELS.gitPull, async () => git.pull());
  register(IPC_CHANNELS.gitPush, async () => git.push());
  register(IPC_CHANNELS.metaDashboard, async () => {
    const project = await storage.dashboard();
    const packet = await intelligence.snapshot(await memoryRetriever.search("workspace architecture decisions documentation source", 6));
    const all = (nodes) => nodes.flatMap((node) => [node, ...node.children ? all(node.children) : []]);
    const files = all(await workspace.list());
    return {
      project,
      recentCommits: await git.log(8).catch(() => []),
      contextHealth: { ...packet.metrics, hasReadme: files.some((file) => /^readme\.md$/i.test(file.name)), noteCount: files.filter((file) => file.extension === "md").length, codeFileCount: files.filter((file) => ["ts", "tsx", "js", "jsx", "py", "cpp", "c"].includes(file.extension ?? "")).length },
      contextSources: packet.artifacts.map((artifact) => ({ id: artifact.id, kind: artifact.kind, title: artifact.title, path: artifact.path, relevance: typeof artifact.metadata?.relevance === "number" ? artifact.metadata.relevance : void 0, reason: typeof artifact.metadata?.reason === "string" ? artifact.metadata.reason : void 0 })),
      contextGeneratedAt: packet.generatedAt
    };
  });
  register(IPC_CHANNELS.metaGoalCreate, async (request) => storage.createGoal(request.title, request.description));
  register(IPC_CHANNELS.metaGoalUpdate, async (request) => storage.updateGoal(request.goalId, request.title, request.description, request.status));
  register(IPC_CHANNELS.metaGoalDelete, async (request) => storage.deleteGoal(request.goalId));
  register(IPC_CHANNELS.metaTaskCreate, async (request) => storage.createTask(request.title, request.description, request.priority));
  register(IPC_CHANNELS.appUpdateStatus, async () => updater.status());
  register(IPC_CHANNELS.appUpdateCheck, async () => updater.check());
  register(IPC_CHANNELS.appUpdateInstall, async () => updater.install());
  register(IPC_CHANNELS.appReleaseOpen, async () => updater.openLatestRelease());
  register(IPC_CHANNELS.appBuildInfo, async () => appBuildInfo());
  register(IPC_CHANNELS.appBuildInfoCopy, async () => {
    const info = appBuildInfo();
    clipboard.writeText(formatAppBuildInfo(info));
    return info;
  });
  register(IPC_CHANNELS.settingsGet, async () => settings.publicSettings());
  register(IPC_CHANNELS.settingsSave, async (request) => {
    const result = await settings.save(request);
    await applyAISettings();
    updater.setChannel(result.updateChannel);
    if (result.embeddingEnabled && result.autoIndex) void runSemanticRefresh(() => semanticIndexer.incremental(), "settings-save");
    return result;
  });
  register(IPC_CHANNELS.settingsTestApi, async () => aiProvider.testConnection());
  register(IPC_CHANNELS.settingsModelsList, async (request) => new OpenAIProvider(await settings.apiConfiguration({ apiKey: request.apiKey, baseUrl: request.apiBaseUrl })).listModels());
  register(IPC_CHANNELS.settingsModelValidate, async (request) => new OpenAIProvider(await settings.apiConfiguration({ apiKey: request.apiKey, baseUrl: request.apiBaseUrl, model: request.apiModel })).validateModel(request.apiModel));
  register(IPC_CHANNELS.settingsEmbeddingModelsList, async (request) => embeddingClient.listModels({ baseUrl: request.embeddingBaseUrl, apiKey: request.embeddingApiKey }));
  register(IPC_CHANNELS.settingsEmbeddingModelValidate, async (request) => embeddingClient.validateModel(request.embeddingModel, { baseUrl: request.embeddingBaseUrl, model: request.embeddingModel, apiKey: request.embeddingApiKey, enabled: true }));
  register(IPC_CHANNELS.settingsTestGithub, async () => settings.testGitHub());
  register(IPC_CHANNELS.settingsRuntimeStatus, async () => {
    const status = await new HermesRuntimeDetector().status(settings.hermesConfiguration());
    const profile = resolveAgentRuntime(settings.publicSettings().agentRuntime, status, status.endpointReachable === true);
    return { ...status, requested: profile.requested, active: profile.active };
  });
  register(IPC_CHANNELS.settingsPlatformCapabilities, async () => {
    const status = await new HermesRuntimeDetector().status(settings.hermesConfiguration());
    const semantic = await storage.semanticIndexStatus().catch(() => null);
    const config = await settings.embeddingConfiguration();
    return platformCapabilities({ platform: process.platform, appDataPath: app.getPath("userData"), resourcePath: process.resourcesPath, hermesStatus: status, embeddingProviderAvailable: config.enabled && (!semantic?.lastError || semantic.state === "ready"), embeddingModelAvailable: semantic?.state === "ready" && semantic.embeddingModel === config.model, semanticIndexHealthy: semantic?.state === "ready", workspaceDatabaseHealthy: Boolean(await storage.dashboard().catch(() => null)), toolRouterAvailable: true });
  });
  register(IPC_CHANNELS.semanticIndexStatus, async () => storage.semanticIndexStatus());
  register(IPC_CHANNELS.semanticIndexRebuild, async () => semanticIndexer.rebuild());
  register(IPC_CHANNELS.contextHealthGet, async () => semanticContext.health());
  register(IPC_CHANNELS.runtimeTelemetry, async () => {
    const [semantic, project] = await Promise.all([storage.semanticIndexStatus(), storage.dashboard()]);
    const requests = project ? await toolRouter.listRequests(project.id) : [];
    const memory = process.memoryUsage();
    const now = Date.now();
    const persistedRunningTasks = project?.tasks.filter((task) => task.status === "running").length ?? 0;
    return {
      sampledAt: Date.now(),
      process: { pid: process.pid, uptimeSeconds: process.uptime(), rssBytes: memory.rss, heapUsedBytes: memory.heapUsed, heapTotalBytes: memory.heapTotal, externalBytes: memory.external, arrayBuffersBytes: memory.arrayBuffers },
      semantic,
      activity: {
        runningTools: Math.max(activeToolOperations.size, requests.filter((request) => request.state === "running").length),
        queuedTools: requests.filter((request) => request.state === "requested").length,
        runningTasks: Math.max(activeTaskOperations.size, persistedRunningTasks),
        activeTerminals: terminalService.list().filter((session) => session.state === "running").length,
        toolsActive: activeToolOperations.size > 0 || now - lastToolActivityAt < 1500,
        tasksActive: activeTaskOperations.size > 0 || now - lastTaskActivityAt < 1500
      }
    };
  });
  register(IPC_CHANNELS.agentSkillsList, async () => {
    const info = workspace.info();
    if (!info) throw new Error("Open a workspace before listing skills.");
    const status = await new HermesRuntimeDetector().status(settings.hermesConfiguration());
    return discoverSkills(skillRootsForWorkspace(info.rootPath, { hermesRoots: status.skillRoots }));
  });
  const nativeAgent = createNativeAgentRuntime({ storage, workspace, agent, toolRouter, taskRuntime, settings, aiProvider, git, emitRuntimeEvent, resolveReasoningRuntime });
  register(IPC_CHANNELS.agentAsk, async (request) => {
    if (!request.prompt.trim()) throw new Error("A prompt is required.");
    return nativeAgent.runAgentTurn(request.conversationId, request.prompt.trim());
  });
  register(IPC_CHANNELS.agentExplainProject, async (request) => nativeAgent.runAgentTurn(request?.conversationId, "Explain this repository as an evidence-grounded architecture summary."));
  register(IPC_CHANNELS.agentReviewChanges, async (request) => nativeAgent.runAgentTurn(request?.conversationId, "Review the current repository changes against its documented architecture and project goals."));
  register(IPC_CHANNELS.agentConversationsState, async (request) => storage.conversationState(request?.conversationId));
  register(IPC_CHANNELS.agentConversationsList, async (request) => (await storage.conversationState(request?.conversationId)).messages);
  register(IPC_CHANNELS.agentConversationsAppend, async (request) => {
    const state = await storage.conversationState(request.conversationId);
    for (const entry of request.entries) await storage.appendConversation(state.activeConversationId, entry.role, entry.content);
    return void 0;
  });
  register(IPC_CHANNELS.agentConversationCreate, async (request) => storage.createConversation(request.title));
  register(IPC_CHANNELS.agentConversationSelect, async (request) => storage.selectConversation(request.conversationId));
  register(IPC_CHANNELS.agentConversationRename, async (request) => storage.renameConversation(request.conversationId, request.title));
  register(IPC_CHANNELS.agentConversationClear, async (request) => storage.clearConversation(request.conversationId));
  register(IPC_CHANNELS.agentConversationDelete, async (request) => storage.deleteConversation(request.conversationId));
  register(IPC_CHANNELS.agentConversationsClearAll, async () => storage.clearAllConversations());
  register(IPC_CHANNELS.agentMemoriesList, async () => storage.listMemories(250, 1200));
  register(IPC_CHANNELS.agentMemoriesStats, async () => storage.memoryStats());
  register(IPC_CHANNELS.agentMemoriesDelete, async (request) => {
    await storage.deleteMemory(request.id);
    return void 0;
  });
  register(IPC_CHANNELS.agentMemoriesClear, async () => storage.clearMemories());
  register(IPC_CHANNELS.agentMemoriesReindex, async () => {
    await memoryIndexer.indexWorkspaceFiles();
    return void 0;
  });
  const toolContext = async () => {
    const project = await storage.dashboard();
    const info = workspace.info();
    const conversation = await storage.conversationState();
    if (!project || !info) throw new Error("Open a workspace first.");
    return { workspaceId: project.id, workspaceRoot: info.rootPath, conversationId: conversation.activeConversationId, modelId: settings.publicSettings().apiModel };
  };
  register(IPC_CHANNELS.toolRequestsList, async () => {
    const project = await storage.dashboard();
    return project ? toolRouter.listRequests(project.id) : [];
  });
  register(IPC_CHANNELS.toolRequestCancel, async (request) => toolRouter.cancel(request.requestId, await toolContext()));
  register(IPC_CHANNELS.toolActionsList, async (request) => storage.listActions(request));
  register(IPC_CHANNELS.toolCatalog, async () => toolRouter.capabilityCatalog(settings.publicSettings().agentExecutionMode));
  register(IPC_CHANNELS.toolExecute, async (request) => {
    const current = settings.publicSettings();
    const context = await toolContext();
    const outcome = await toolRouter.request({ id: request.requestId, name: request.toolName, provider: "forge-tool-panel", arguments: request.arguments }, { ...context, repositoryRoot: workspace.info()?.gitRoot ?? void 0, filesystemScope: current.filesystemScope, projectTreeRoot: current.projectTreeRoot || void 0, executionMode: current.agentExecutionMode, networkAccess: current.networkAccess, backgroundTasksEnabled: current.backgroundTasksEnabled, autoRepairToolArguments: current.autoRepairToolArguments, processMode: current.processMode, processTimeoutMs: current.processTimeoutMs, backgroundTaskTimeoutMs: current.backgroundTaskTimeoutMs, userRequest: "The user explicitly ran this capability from the FORGE Tooling panel." });
    if (!outcome.result) throw new Error(`Tool ${request.toolName} did not return an execution result.`);
    return outcome.result;
  });
  register(IPC_CHANNELS.agentStopAll, async () => {
    const project = await storage.dashboard();
    if (!project) return { toolsCancelled: 0, tasksCancelled: 0 };
    const toolsCancelled = await toolRouter.cancelAll(project.id);
    const tasksCancelled = await taskRuntime.stopAll();
    return { toolsCancelled, tasksCancelled };
  });
  register(IPC_CHANNELS.editorDirtyUpdate, async (request) => {
    dirtyEditorPaths.clear();
    for (const value of request.paths) if (value && !value.split(/[\\/]/).includes("..")) dirtyEditorPaths.add(value);
    return void 0;
  });
  register(IPC_CHANNELS.terminalCreate, async (request) => terminalService.create(request?.workingDirectory, request?.columns, request?.rows));
  register(IPC_CHANNELS.terminalList, async () => terminalService.list());
  register(IPC_CHANNELS.terminalInput, async (request) => {
    terminalService.input(request.sessionId, request.data);
    return void 0;
  });
  register(IPC_CHANNELS.terminalResize, async (request) => {
    terminalService.resize(request.sessionId, request.columns, request.rows);
    return void 0;
  });
  register(IPC_CHANNELS.terminalTerminate, async (request) => {
    terminalService.terminate(request.sessionId);
    return void 0;
  });
  register(IPC_CHANNELS.terminalRestart, async (request) => terminalService.restart(request.sessionId));
  register(IPC_CHANNELS.terminalRemove, async (request) => {
    terminalService.remove(request.sessionId);
    return void 0;
  });
  register(IPC_CHANNELS.tasksList, async () => taskRuntime.list());
  register(IPC_CHANNELS.tasksGet, async (request) => taskRuntime.get(request.taskId));
  register(IPC_CHANNELS.tasksCreate, async (request) => taskRuntime.create(request));
  register(IPC_CHANNELS.tasksUpdate, async (request) => taskRuntime.update(request.taskId, request.draft));
  register(IPC_CHANNELS.tasksCreateRelease, async (request) => taskRuntime.createRelease(request.version, request.originatingConversationId));
  register(IPC_CHANNELS.tasksResume, async (request) => nativeAgent.runTaskStep(request.taskId));
  register(IPC_CHANNELS.tasksPause, async (request) => taskRuntime.pause(request.taskId, request.reason));
  register(IPC_CHANNELS.tasksCancel, async (request) => taskRuntime.cancel(request.taskId, request.reason, request.trackingOnly));
  register(IPC_CHANNELS.tasksRedirect, async (request) => taskRuntime.redirect(request.taskId, request.instruction));
  register(IPC_CHANNELS.tasksDelete, async (request) => {
    await storage.deletePersistentTask(request.taskId);
    return void 0;
  });
  register(IPC_CHANNELS.tasksRetryStep, async (request) => {
    await taskRuntime.retryStep(request.taskId, request.stepId);
    return nativeAgent.runTaskStep(request.taskId);
  });
  register(IPC_CHANNELS.tasksHandoff, async (request) => taskRuntime.generateHandoff(request.taskId));
  register(IPC_CHANNELS.browserNavigate, async (request) => navigateBrowser(request.url));
  register(IPC_CHANNELS.browserLayout, async (request) => {
    setBrowserLayout(request);
    return browserState();
  });
  register(IPC_CHANNELS.browserBack, async () => {
    const tab = activeBrowserTab();
    if (tab?.view.webContents.canGoBack()) tab.view.webContents.goBack();
    return browserState();
  });
  register(IPC_CHANNELS.browserForward, async () => {
    const tab = activeBrowserTab();
    if (tab?.view.webContents.canGoForward()) tab.view.webContents.goForward();
    return browserState();
  });
  register(IPC_CHANNELS.browserReload, async () => {
    const tab = activeBrowserTab();
    if (tab) tab.view.webContents.reload();
    return browserState();
  });
  register(IPC_CHANNELS.browserHome, async () => showBrowserHome());
  register(IPC_CHANNELS.browserTabNew, async () => openBlankBrowserTab());
  register(IPC_CHANNELS.browserTabClose, async (request) => closeBrowserTab(request.tabId));
  register(IPC_CHANNELS.browserTabSelect, async (request) => selectBrowserTab(request.tabId));
  register(IPC_CHANNELS.browserBookmarkAdd, async () => addActiveBrowserBookmark());
  register(IPC_CHANNELS.browserBookmarkRemove, async (request) => removeBrowserBookmark(request.bookmarkId));
  register(IPC_CHANNELS.forgeLiveStart, async () => liveService().start());
  register(IPC_CHANNELS.forgeLiveStop, async () => forgeLive ? forgeLive.stop() : { workspaceId: workspace.info()?.rootPath ?? "", status: "stopped", mode: "static" });
  register(IPC_CHANNELS.forgeLiveRestart, async () => liveService().restart());
  register(IPC_CHANNELS.forgeLiveStatus, async () => forgeLive?.status() ?? { workspaceId: workspace.info()?.rootPath ?? "", status: "stopped", mode: "static" });
  register(IPC_CHANNELS.forgeLiveOpenPreview, async () => {
    const live = await liveService().start();
    if (!live.url) throw new Error("FORGE Live did not produce a preview URL.");
    return navigateBrowser(live.url);
  });
  register(IPC_CHANNELS.forgeLiveCopyUrl, async () => {
    const url = forgeLive?.status().url;
    if (!url) throw new Error("Start FORGE Live before copying its URL.");
    clipboard.writeText(url);
    return { url };
  });
  register(IPC_CHANNELS.forgeOsContext, async () => forgeOs.context());
  register(IPC_CHANNELS.forgeOsApplications, async () => forgeOs.discoverApplications());
  register(IPC_CHANNELS.forgeOsApplicationLaunch, async (request) => {
    await forgeOs.launchApplication(request.id);
    return void 0;
  });
  register(IPC_CHANNELS.forgeOsOverview, async () => forgeOs.overview(app.getVersion()));
  register(IPC_CHANNELS.forgeOsSessionAction, async (request) => {
    await forgeOs.sessionAction(request.action);
    if (request.action === "logout") app.quit();
    return void 0;
  });
}
function createWindow() {
  const rendererFile = join(__dirname, "../renderer/index.html");
  const packagedRendererUrl = pathToFileURL(rendererFile).toString();
  const forgeOsShell = process.platform === "linux" && (process.env.FORGE_OS_SESSION === "1" || process.env.XDG_CURRENT_DESKTOP?.toUpperCase() === "FORGE") && process.env.FORGE_SHELL_MODE !== "0";
  mainWindow = new BrowserWindow({ width: 1500, height: 950, minWidth: 1100, minHeight: 700, show: false, title: "FORGE", webPreferences: { preload: join(__dirname, "../preload/index.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
  if (forgeOsShell) mainWindow.maximize();
  mainWindow.on("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
    disposeBrowserTabs();
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const developmentUrl = process.env.ELECTRON_RENDERER_URL;
    const allowed = is.dev && developmentUrl ? new URL(url).origin === new URL(developmentUrl).origin : url === packagedRendererUrl;
    if (!allowed) event.preventDefault();
  });
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    rendererSource = "development URL";
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    rendererSource = app.isPackaged ? "file:// packaged app.asar" : "file:// development build";
    void mainWindow.loadFile(rendererFile);
  }
}
app.setName("FORGE");
const ownsSingleInstanceLock = app.requestSingleInstanceLock();
if (!ownsSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    const startupWorkspace = commandLine.find((argument) => argument.startsWith("--workspace="))?.slice("--workspace=".length);
    if (startupWorkspace) void openWorkspaceAt(startupWorkspace).catch(() => void 0);
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.show();
    mainWindow?.focus();
  });
  app.whenReady().then(async () => {
    const developmentIcon = join(process.cwd(), "apps/desktop/resources/ForgeIcon-v2.5-1024.png");
    if (process.platform === "darwin" && is.dev && app.dock && existsSync(developmentIcon)) app.dock.setIcon(developmentIcon);
    try {
      await settings.init();
      await applyAISettings();
      updater.setChannel(settings.updateChannel());
      registerHandlers();
      const startupWorkspace = process.argv.find((argument) => argument.startsWith("--workspace="))?.slice("--workspace=".length) ?? settings.lastWorkspacePath();
      if (startupWorkspace) await openWorkspaceAt(startupWorkspace).catch(() => void 0);
      createWindow();
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    } catch (error) {
      dialog.showErrorBox("FORGE could not start", error instanceof Error ? error.message : String(error));
      app.quit();
    }
  });
  app.on("window-all-closed", async () => {
    terminalService.dispose();
    await forgeLive?.stop().catch(() => void 0);
    forgeLive = null;
    await semanticIndexer.stop();
    await storage.close();
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", () => {
    void forgeLive?.stop().catch(() => void 0);
  });
}
