
import typescript from 'rollup-plugin-typescript2'
import external from 'rollup-plugin-peer-deps-external'
import { uglify } from 'rollup-plugin-uglify';
import commonjs from '@rollup/plugin-commonjs';

const config = {
    input: './index.ts',
    output: [
        {
            globals: {
                'lodash': '_',
                'acey': 'acey',
            },
            file: "dist/index.js",
            format: 'umd',
            name: 'polyprice',
        },
    ],
    plugins: [
        external(),
        typescript({
            tsconfig: 'tsconfig.json',
            tsconfigOverride: { compilerOptions: { module: 'ES2020' } },
        }),
        commonjs(),
        uglify()
    ]
}

export default config