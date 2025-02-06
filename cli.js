#!/usr/bin/env node
"use strict";

import meow from "meow";
import { dirname } from "node:path";
import { readPackageUpSync } from "read-pkg-up";
import { fileURLToPath } from "node:url";
import { parse } from "semver";
import gltf from "./src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const parseVersion = (pkgJson, dep, cbs = {}) => {
  if (pkgJson.dependencies[dep]) {
    let raw = cwdPackageJson.dependencies[dep];
    if (raw.includes("^") || raw.includes("~")) {
      // remove first character
      raw = raw.slice(1);
    }

    const parsed = parse(raw);
    const major = parsed.major;

    cbs.afterParse?.(major, parsed);
    return parsed;
  } else {
    cbs.depNotFound?.();
  }
};

const cli = meow(
  `
  Usage
    $ npx angular-three-gltf@latest [Model.glb] [options]

  Options
    --output, -o        Output file name/path
    --selector          Selector for the component
    --name, -n          Name of the component
    --keepnames, -k     Keep original names
    --keepgroups, -K    Keep (empty) groups, disable pruning
    --bones, -b         Layout bones declaratively (default: false)
    --meta, -m          Include metadata (as userData)
    --shadows, -s       Let meshes cast and receive shadows
    --printwidth, -w    Prettier printWidth (default: 120)
    --precision, -p     Number of fractional digits (default: 2)
    --draco, -d         Draco binary path
    --preload -P        Add preload method to module script
    --root, -r          Sets directory from which .gltf file is served
    --transform, -T     Transform the asset for the web (draco, prune, resize)
      --resolution, -R  Resolution for texture resizing (default: 1024)
      --keepmeshes, -j  Do not join compatible meshes
      --keepmaterials, -M Do not palette join materials
      --format, -f      Texture format (default: "webp")
      --simplify, -S    Mesh simplification (default: false)
        --ratio         Simplifier ratio (default: 0)
        --error         Simplifier error threshold (default: 0.0001)
    --console, -c       Log component to console, won't produce a file
    --debug, -D         Debug output
`,
  {
    importMeta: import.meta,
    flags: {
      output: { type: "string", shortFlag: "o" },
      selector: { type: "string" },
      name: { type: "string" },
      keepnames: { type: "boolean", shortFlag: "k" },
      keepgroups: { type: "boolean", shortFlag: "K" },
      bones: { type: "boolean", shortFlag: "b", default: false },
      shadows: { type: "boolean", shortFlag: "s" },
      printwidth: { type: "number", shortFlag: "p", default: 120 },
      meta: { type: "boolean", shortFlag: "m" },
      precision: { type: "number", shortFlag: "p", default: 3 },
      preload: { type: "boolean", shortFlag: "P", default: false },
      draco: { type: "string", shortFlag: "d" },
      root: { type: "string", shortFlag: "r" },
      transform: { type: "boolean", shortFlag: "T" },
      resolution: { type: "number", shortFlag: "R", default: 1024 },
      degrade: { type: "string", shortFlag: "q", default: "" },
      degraderesolution: { type: "number", shortFlag: "Q", default: 512 },
      simplify: { type: "boolean", shortFlag: "S", default: false },
      keepmeshes: { type: "boolean", shortFlag: "j", default: false },
      keepmaterials: { type: "boolean", shortFlag: "M", default: false },
      ratio: { type: "number", default: 0.75 },
      error: { type: "number", default: 0.001 },
      debug: { type: "boolean", shortFlag: "D" },
      format: { type: "string", shortFlag: "f", default: "webp" },
      console: { type: "boolean", shortFlag: "c" },

      // instance: { type: "boolean", shortFlag: "i" },
      // instanceall: { type: "boolean", shortFlag: "I" },
    },
  },
);

const { packageJson: cwdPackageJson } = readPackageUpSync({
  cwd: process.cwd(),
});
const { packageJson } = readPackageUpSync({ cwd: __dirname });

const ngVer = parseVersion(cwdPackageJson, "@angular/core", {
  afterParse: (major, parsed) => {
    if (major < 18) {
      console.error("Angular version must be >= 18");
      process.exit(1);
    }

    console.log("Detected Angular version: ", parsed.version);
  },
  depNotFound: () => {
    console.warn("Executing outside of Angular workspace");
  },
});

const ngtVer = parseVersion(cwdPackageJson, "angular-three", {
  afterParse: (_major, parsed) => {
    console.log("Detected Angular Three version: ", parsed.version);
  },
  depNotFound: () => {
    console.warn("Executing outside of Angular Three enabled workspace");
  },
});

if (cli.input.length === 0) {
  console.log(cli.help);
} else {
  const file = cli.input[0];

  let nameExt = file.match(/[-_\w\d\s]+[.][\w]+$/i)[0];
  let name = nameExt.split(".").slice(0, -1).join(".");
  let output = name + ".ts";

  if (cli.flags.output) {
    if (cli.flags.output.endsWith(".ts")) {
      output = cli.flags.output;
    } else {
      output = `${cli.output.flags}/${output}`;
    }
  }

  const showLog = (log) => {
    console.info("log:", log);
  };

  const config = {
    ...cli.flags,
    showLog,
    timeout: 0,
    delay: 1,
    ngVer: ngVer.major,
    ngtVer,
    header: `Auto-generated by: https://github.com/angular-threejs/gltf
Command: npx angular-three-gltf&#64;${packageJson.version} ${process.argv.slice(2).join(" ")}`,
  };

  try {
    await gltf(file, output, config);
  } catch (e) {
    console.error(e);
  }
}
