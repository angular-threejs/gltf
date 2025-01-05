import "jsdom-global";
import fs from "fs";
import path from "path";
import transform from "./utils/transform.js";
import * as prettier from "prettier";
import THREE from "three";

global.THREE = THREE;

import { GLTFLoader } from "./bin/GLTFLoader.js";
import { DRACOLoader } from "./bin/DRACOLoader.js";
DRACOLoader.getDecoderModule = () => {};

import parse from "./utils/parser.js";

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(new DRACOLoader());

function toArrayBuffer(buf) {
  var ab = new ArrayBuffer(buf.length);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buf.length; ++i) view[i] = buf[i];
  return ab;
}

function roundOff(value) {
  return Math.round(value * 100) / 100;
}

function getFileSize(file) {
  const stats = fs.statSync(file);
  let fileSize = stats.size;
  let fileSizeKB = roundOff(fileSize * 0.001);
  let fileSizeMB = roundOff(fileSizeKB * 0.001);
  return {
    size: fileSizeKB > 1000 ? `${fileSizeMB}MB` : `${fileSizeKB}KB`,
    sizeKB: fileSizeKB,
  };
}

export default function (file, output, options) {
  function getRelativeFilePath(file) {
    const filePath = path.resolve(file);
    const rootPath = options.root
      ? path.resolve(options.root)
      : path.dirname(file);
    const relativePath = path.relative(rootPath, filePath) || "";
    if (process.platform === "win32") return relativePath.replace(/\\/g, "/");
    return relativePath;
  }

  function getTransformOutput(output, file) {
    const { name, dir } = path.parse(path.resolve(file));

    // default angular's assets directory
    if (file.includes("public")) {
      return path.join(dir, name + "-transformed.glb");
    }

    const outputDir = path.parse(path.resolve(output ?? file)).dir;
    return path.join(outputDir, name + "-transformed.glb");
  }

  // function getFilePath(file) {
  //   // remove public from path. assuming that public is the assets root
  //   if (file.includes("public/")) {
  //     file = file.replace("public/", "");
  //   }
  //   return `${options.root ?? "/"}${options.root ? path.basename(file) : path.normalize(file)}`;
  // }

  return new Promise((resolve, reject) => {
    async function run(stream) {
      let size = "";

      if (options.transform || options.instance || options.instanceall) {
        const transformOut = getTransformOutput(output, file);
        console.warn(
          `Transform output ${transformOut} might not work for you. Move the file manually if needed.`,
        );

        await transform(file, transformOut, options);
        const { size: sizeOriginal, sizeKB: sizeKBOriginal } =
          getFileSize(file);
        const { size: sizeTransformed, sizeKB: sizeKBTransformed } =
          getFileSize(transformOut);
        size = `${file} [${sizeOriginal}] > ${transformOut} [${sizeTransformed}] (${Math.round(
          100 - (sizeKBTransformed / sizeKBOriginal) * 100,
        )}%)`;
        file = transformOut;
      }

      const filePath = getRelativeFilePath(file);
      const data = fs.readFileSync(file);
      const arrayBuffer = toArrayBuffer(data);

      gltfLoader.parse(
        arrayBuffer,
        "",
        async (gltf) => {
          let output = parse(filePath, gltf, { ...options, size });

          try {
            output = await prettier.format(output, {
              semi: false,
              bracketSameLine: true,
              printWidth: options.printwidth || 120,
              singleQuote: true,
              parser: "angular",
            });
          } catch {
            // prettier error; do nothing
          }

          if (options.console) console.log(output);
          else {
            try {
              stream?.write(output);
              stream?.end();
            } catch (e) {
              console.log(e);
              reject(e);
            }
          }

          resolve();
        },
        (reason) => {
          console.log(reason);
          reject(reason);
        },
      );
    }

    if (options.console) {
      run();
    } else {
      const stream = fs.createWriteStream(path.resolve(output));
      stream.once("open", async () => {
        if (!fs.existsSync(file)) reject(file + " does not exist.");
        else run(stream);
      });
    }

    // const stream = fs.createWriteStream(path.resolve(output));
    // stream.once("open", async (fd) => {
    //   if (!fs.existsSync(file)) {
    //     reject(file + " does not exist.");
    //   } else {
    //     // Process GLTF
    //     if (options.transform || options.instance || options.instanceall) {
    //       const { name, dir } = path.parse(file);
    //       const transformOut = path.join(dir, name + "-transformed.glb");
    //       await transform(file, transformOut, options);
    //       file = transformOut;
    //     }
    //     resolve();
    //
    //     const filePath = getFilePath(file);
    //     const data = fs.readFileSync(file);
    //     const arrayBuffer = toArrayBuffer(data);
    //
    //     gltfLoader.parse(
    //       arrayBuffer,
    //       "",
    //       async (gltf) => {
    //         const raw = parse(filePath, gltf, options);
    //         try {
    //           const prettiered = await prettier.format(raw, {
    //             semi: false,
    //             bracketSameLine: true,
    //             printWidth: options.printwidth || 120,
    //             singleQuote: true,
    //             parser: "typescript",
    //           });
    //           stream.write(prettiered);
    //           stream.end();
    //           resolve();
    //         } catch (error) {
    //           console.error(error);
    //           stream.write(raw);
    //           stream.end();
    //           reject(error);
    //         }
    //       },
    //       reject,
    //     );
    //   }
    // });
  });
}
