
import typescript from '@rollup/plugin-typescript';
import { uglify } from 'rollup-plugin-uglify';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import pkg from './package.json';

const config = {
    input: './index.ts',
    output: [
        {
            globals: {
                'acey': 'acey',
                'node-fetch-native': 'fetch'
            },
            file: "dist/index.js",
            format: 'umd',
            name: 'polyprice',
        },
    ],
    plugins: [
        typescript({
            tsconfig: 'tsconfig.rollup.json',
            declaration: true,
            include: [
                "src/**/*",
                "index.ts",
            ]
        }),
        commonjs(),
        uglify(),
        json(),
    ],
}

pkg.type = 'module';

export default config