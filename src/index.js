import "jsdom-global";
import fs from "fs";
import path from "path";
import transform from "./utils/transform.js";
import * as prettier from "prettier";
import THREE from "three";

global.THREE = THREE;

import "./bin/GLTFLoader.js";
import DracoLoader from "./bin/DRACOLoader.js";
THREE.DRACOLoader.getDecoderModule = () => {};

import parse from "./utils/parser.js";

const gltfLoader = new THREE.GLTFLoader();
gltfLoader.setDRACOLoader(new DracoLoader());

function toArrayBuffer(buf) {
  var ab = new ArrayBuffer(buf.length);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buf.length; ++i) view[i] = buf[i];
  return ab;
}

export default function (file, output, options) {
  function getFilePath(file) {
    // remove public from path. assuming that public is the assets root
    if (file.includes("public")) {
      file = file.replace("public", "");
    }
    return `${options.root ?? "/"}${options.root ? path.basename(file) : path.normalize(file)}`;
  }

  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(output);
    stream.once("open", async (fd) => {
      if (!fs.existsSync(file)) {
        reject(file + " does not exist.");
      } else {
        // Process GLTF
        if (options.transform || options.instance || options.instanceall) {
          const { name, dir } = path.parse(file);
          const transformOut = path.join(dir, name + "-transformed.glb");
          await transform(file, transformOut, options);
          file = transformOut;
        }
        resolve();

        const filePath = getFilePath(file);
        const data = fs.readFileSync(file);
        const arrayBuffer = toArrayBuffer(data);

        gltfLoader.parse(
          arrayBuffer,
          "",
          async (gltf) => {
            const raw = parse(filePath, gltf, options);
            try {
              const prettiered = await prettier.format(raw, {
                semi: false,
                bracketSameLine: true,
                printWidth: options.printwidth || 120,
                singleQuote: true,
                parser: "typescript",
              });
              stream.write(prettiered);
              stream.end();
              resolve();
            } catch (error) {
              console.error(error);
              stream.write(raw);
              stream.end();
              reject(error);
            }
          },
          reject,
        );
      }
    });
  });
}
