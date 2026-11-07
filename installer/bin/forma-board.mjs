#!/usr/bin/env node
// Installs Forma on this Mac, or updates it: downloads the latest Forma.app
// from the GitHub releases, puts it in Applications and opens it. Your boards
// live in ~/Documents/Forma and are never touched.

import { execFileSync, spawnSync } from "node:child_process"
import { accessSync, constants, createWriteStream, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"

const REPO = "gajjar4/forma"
const ASSET = "Forma-macos.app.tar.gz"
const ID = "com.forma.app"
// Both can be pointed elsewhere for testing a release before it's public.
const URL = process.env.FORMA_DOWNLOAD_URL ?? `https://github.com/${REPO}/releases/latest/download/${ASSET}`
const APPS = process.env.FORMA_APPS_DIR

const say = (line = "") => console.log(line)
const fail = (line) => {
  console.error(`\n${line}\n`)
  process.exit(1)
}

const writable = (dir) => {
  try {
    accessSync(dir, constants.W_OK)
    return true
  } catch {
    return false
  }
}

const versionOf = (app) => {
  try {
    return execFileSync("plutil", ["-extract", "CFBundleShortVersionString", "raw", "-o", "-", join(app, "Contents/Info.plist")], {
      encoding: "utf8",
    }).trim()
  } catch {
    return null
  }
}

const running = (app) => spawnSync("pgrep", ["-f", join(app, "Contents/MacOS/")]).status === 0

async function main() {
  if (process.platform !== "darwin") fail("Forma runs on macOS for now.")

  const apps = APPS ?? (writable("/Applications") ? "/Applications" : join(homedir(), "Applications"))
  mkdirSync(apps, { recursive: true })
  const dest = join(apps, "Forma.app")
  const before = existsSync(dest) ? versionOf(dest) : null

  say()
  say(before ? "  Updating Forma" : "  Installing Forma")
  const tmp = mkdtempSync(join(tmpdir(), "forma-"))
  try {
    const res = await fetch(URL, { redirect: "follow" })
    if (!res.ok || !res.body) fail(`Couldn't download Forma (${res.status}). Check your connection and try again.`)
    const tarball = join(tmp, ASSET)
    await pipeline(Readable.fromWeb(res.body), createWriteStream(tarball))
    execFileSync("tar", ["-xzf", tarball, "-C", tmp])
    const fresh = join(tmp, "Forma.app")
    if (!existsSync(fresh)) fail("The download didn't have Forma.app in it. Try again in a minute.")
    const after = versionOf(fresh)

    if (existsSync(dest) && running(dest)) {
      say("  Closing Forma first. Your boards are saved as you go.")
      spawnSync("osascript", ["-e", `tell application id "${ID}" to quit`])
      for (let i = 0; i < 40 && running(dest); i++) await new Promise((r) => setTimeout(r, 250))
    }
    rmSync(dest, { recursive: true, force: true })
    execFileSync("ditto", [fresh, dest])

    say(
      before && before === after
        ? `  Forma ${after} is already the newest. It's in ${apps}.`
        : `  Forma ${after ?? ""} is in ${apps}.`.replace("  Forma  is", "  Forma is"),
    )
    if (!process.env.FORMA_NO_OPEN) spawnSync("open", [dest])
    say("  Run npx forma-board again any time to update.")
    say()
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

main().catch((e) => fail(`Something went wrong: ${e.message}`))
