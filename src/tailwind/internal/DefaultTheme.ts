/**
 * Copyright (c) Tailwind Labs, Inc. MIT License.
 * @see https://github.com/tailwindlabs/tailwindcss/blob/main/packages/tailwindcss/theme.css
 * @see https://github.com/tailwindlabs/tailwindcss/blob/main/packages/tailwindcss/preflight.css
 */

export const variables: ReadonlyArray<readonly [name: string, value: string, reference: boolean]> = [
  [
    "--font-sans",
    "ui-sans-serif, system-ui, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\"",
    false,
  ],
  ["--font-serif", "ui-serif, Georgia, Cambria, \"Times New Roman\", Times, serif", false],
  [
    "--font-mono",
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
    false,
  ],
  ["--color-red-50", "oklch(97.1% 0.013 17.38)", false],
  ["--color-red-100", "oklch(93.6% 0.032 17.717)", false],
  ["--color-red-200", "oklch(88.5% 0.062 18.334)", false],
  ["--color-red-300", "oklch(80.8% 0.114 19.571)", false],
  ["--color-red-400", "oklch(70.4% 0.191 22.216)", false],
  ["--color-red-500", "oklch(63.7% 0.237 25.331)", false],
  ["--color-red-600", "oklch(57.7% 0.245 27.325)", false],
  ["--color-red-700", "oklch(50.5% 0.213 27.518)", false],
  ["--color-red-800", "oklch(44.4% 0.177 26.899)", false],
  ["--color-red-900", "oklch(39.6% 0.141 25.723)", false],
  ["--color-red-950", "oklch(25.8% 0.092 26.042)", false],
  ["--color-orange-50", "oklch(98% 0.016 73.684)", false],
  ["--color-orange-100", "oklch(95.4% 0.038 75.164)", false],
  ["--color-orange-200", "oklch(90.1% 0.076 70.697)", false],
  ["--color-orange-300", "oklch(83.7% 0.128 66.29)", false],
  ["--color-orange-400", "oklch(75% 0.183 55.934)", false],
  ["--color-orange-500", "oklch(70.5% 0.213 47.604)", false],
  ["--color-orange-600", "oklch(64.6% 0.222 41.116)", false],
  ["--color-orange-700", "oklch(55.3% 0.195 38.402)", false],
  ["--color-orange-800", "oklch(47% 0.157 37.304)", false],
  ["--color-orange-900", "oklch(40.8% 0.123 38.172)", false],
  ["--color-orange-950", "oklch(26.6% 0.079 36.259)", false],
  ["--color-amber-50", "oklch(98.7% 0.022 95.277)", false],
  ["--color-amber-100", "oklch(96.2% 0.059 95.617)", false],
  ["--color-amber-200", "oklch(92.4% 0.12 95.746)", false],
  ["--color-amber-300", "oklch(87.9% 0.169 91.605)", false],
  ["--color-amber-400", "oklch(82.8% 0.189 84.429)", false],
  ["--color-amber-500", "oklch(76.9% 0.188 70.08)", false],
  ["--color-amber-600", "oklch(66.6% 0.179 58.318)", false],
  ["--color-amber-700", "oklch(55.5% 0.163 48.998)", false],
  ["--color-amber-800", "oklch(47.3% 0.137 46.201)", false],
  ["--color-amber-900", "oklch(41.4% 0.112 45.904)", false],
  ["--color-amber-950", "oklch(27.9% 0.077 45.635)", false],
  ["--color-yellow-50", "oklch(98.7% 0.026 102.212)", false],
  ["--color-yellow-100", "oklch(97.3% 0.071 103.193)", false],
  ["--color-yellow-200", "oklch(94.5% 0.129 101.54)", false],
  ["--color-yellow-300", "oklch(90.5% 0.182 98.111)", false],
  ["--color-yellow-400", "oklch(85.2% 0.199 91.936)", false],
  ["--color-yellow-500", "oklch(79.5% 0.184 86.047)", false],
  ["--color-yellow-600", "oklch(68.1% 0.162 75.834)", false],
  ["--color-yellow-700", "oklch(55.4% 0.135 66.442)", false],
  ["--color-yellow-800", "oklch(47.6% 0.114 61.907)", false],
  ["--color-yellow-900", "oklch(42.1% 0.095 57.708)", false],
  ["--color-yellow-950", "oklch(28.6% 0.066 53.813)", false],
  ["--color-lime-50", "oklch(98.6% 0.031 120.757)", false],
  ["--color-lime-100", "oklch(96.7% 0.067 122.328)", false],
  ["--color-lime-200", "oklch(93.8% 0.127 124.321)", false],
  ["--color-lime-300", "oklch(89.7% 0.196 126.665)", false],
  ["--color-lime-400", "oklch(84.1% 0.238 128.85)", false],
  ["--color-lime-500", "oklch(76.8% 0.233 130.85)", false],
  ["--color-lime-600", "oklch(64.8% 0.2 131.684)", false],
  ["--color-lime-700", "oklch(53.2% 0.157 131.589)", false],
  ["--color-lime-800", "oklch(45.3% 0.124 130.933)", false],
  ["--color-lime-900", "oklch(40.5% 0.101 131.063)", false],
  ["--color-lime-950", "oklch(27.4% 0.072 132.109)", false],
  ["--color-green-50", "oklch(98.2% 0.018 155.826)", false],
  ["--color-green-100", "oklch(96.2% 0.044 156.743)", false],
  ["--color-green-200", "oklch(92.5% 0.084 155.995)", false],
  ["--color-green-300", "oklch(87.1% 0.15 154.449)", false],
  ["--color-green-400", "oklch(79.2% 0.209 151.711)", false],
  ["--color-green-500", "oklch(72.3% 0.219 149.579)", false],
  ["--color-green-600", "oklch(62.7% 0.194 149.214)", false],
  ["--color-green-700", "oklch(52.7% 0.154 150.069)", false],
  ["--color-green-800", "oklch(44.8% 0.119 151.328)", false],
  ["--color-green-900", "oklch(39.3% 0.095 152.535)", false],
  ["--color-green-950", "oklch(26.6% 0.065 152.934)", false],
  ["--color-emerald-50", "oklch(97.9% 0.021 166.113)", false],
  ["--color-emerald-100", "oklch(95% 0.052 163.051)", false],
  ["--color-emerald-200", "oklch(90.5% 0.093 164.15)", false],
  ["--color-emerald-300", "oklch(84.5% 0.143 164.978)", false],
  ["--color-emerald-400", "oklch(76.5% 0.177 163.223)", false],
  ["--color-emerald-500", "oklch(69.6% 0.17 162.48)", false],
  ["--color-emerald-600", "oklch(59.6% 0.145 163.225)", false],
  ["--color-emerald-700", "oklch(50.8% 0.118 165.612)", false],
  ["--color-emerald-800", "oklch(43.2% 0.095 166.913)", false],
  ["--color-emerald-900", "oklch(37.8% 0.077 168.94)", false],
  ["--color-emerald-950", "oklch(26.2% 0.051 172.552)", false],
  ["--color-teal-50", "oklch(98.4% 0.014 180.72)", false],
  ["--color-teal-100", "oklch(95.3% 0.051 180.801)", false],
  ["--color-teal-200", "oklch(91% 0.096 180.426)", false],
  ["--color-teal-300", "oklch(85.5% 0.138 181.071)", false],
  ["--color-teal-400", "oklch(77.7% 0.152 181.912)", false],
  ["--color-teal-500", "oklch(70.4% 0.14 182.503)", false],
  ["--color-teal-600", "oklch(60% 0.118 184.704)", false],
  ["--color-teal-700", "oklch(51.1% 0.096 186.391)", false],
  ["--color-teal-800", "oklch(43.7% 0.078 188.216)", false],
  ["--color-teal-900", "oklch(38.6% 0.063 188.416)", false],
  ["--color-teal-950", "oklch(27.7% 0.046 192.524)", false],
  ["--color-cyan-50", "oklch(98.4% 0.019 200.873)", false],
  ["--color-cyan-100", "oklch(95.6% 0.045 203.388)", false],
  ["--color-cyan-200", "oklch(91.7% 0.08 205.041)", false],
  ["--color-cyan-300", "oklch(86.5% 0.127 207.078)", false],
  ["--color-cyan-400", "oklch(78.9% 0.154 211.53)", false],
  ["--color-cyan-500", "oklch(71.5% 0.143 215.221)", false],
  ["--color-cyan-600", "oklch(60.9% 0.126 221.723)", false],
  ["--color-cyan-700", "oklch(52% 0.105 223.128)", false],
  ["--color-cyan-800", "oklch(45% 0.085 224.283)", false],
  ["--color-cyan-900", "oklch(39.8% 0.07 227.392)", false],
  ["--color-cyan-950", "oklch(30.2% 0.056 229.695)", false],
  ["--color-sky-50", "oklch(97.7% 0.013 236.62)", false],
  ["--color-sky-100", "oklch(95.1% 0.026 236.824)", false],
  ["--color-sky-200", "oklch(90.1% 0.058 230.902)", false],
  ["--color-sky-300", "oklch(82.8% 0.111 230.318)", false],
  ["--color-sky-400", "oklch(74.6% 0.16 232.661)", false],
  ["--color-sky-500", "oklch(68.5% 0.169 237.323)", false],
  ["--color-sky-600", "oklch(58.8% 0.158 241.966)", false],
  ["--color-sky-700", "oklch(50% 0.134 242.749)", false],
  ["--color-sky-800", "oklch(44.3% 0.11 240.79)", false],
  ["--color-sky-900", "oklch(39.1% 0.09 240.876)", false],
  ["--color-sky-950", "oklch(29.3% 0.066 243.157)", false],
  ["--color-blue-50", "oklch(97% 0.014 254.604)", false],
  ["--color-blue-100", "oklch(93.2% 0.032 255.585)", false],
  ["--color-blue-200", "oklch(88.2% 0.059 254.128)", false],
  ["--color-blue-300", "oklch(80.9% 0.105 251.813)", false],
  ["--color-blue-400", "oklch(70.7% 0.165 254.624)", false],
  ["--color-blue-500", "oklch(62.3% 0.214 259.815)", false],
  ["--color-blue-600", "oklch(54.6% 0.245 262.881)", false],
  ["--color-blue-700", "oklch(48.8% 0.243 264.376)", false],
  ["--color-blue-800", "oklch(42.4% 0.199 265.638)", false],
  ["--color-blue-900", "oklch(37.9% 0.146 265.522)", false],
  ["--color-blue-950", "oklch(28.2% 0.091 267.935)", false],
  ["--color-indigo-50", "oklch(96.2% 0.018 272.314)", false],
  ["--color-indigo-100", "oklch(93% 0.034 272.788)", false],
  ["--color-indigo-200", "oklch(87% 0.065 274.039)", false],
  ["--color-indigo-300", "oklch(78.5% 0.115 274.713)", false],
  ["--color-indigo-400", "oklch(67.3% 0.182 276.935)", false],
  ["--color-indigo-500", "oklch(58.5% 0.233 277.117)", false],
  ["--color-indigo-600", "oklch(51.1% 0.262 276.966)", false],
  ["--color-indigo-700", "oklch(45.7% 0.24 277.023)", false],
  ["--color-indigo-800", "oklch(39.8% 0.195 277.366)", false],
  ["--color-indigo-900", "oklch(35.9% 0.144 278.697)", false],
  ["--color-indigo-950", "oklch(25.7% 0.09 281.288)", false],
  ["--color-violet-50", "oklch(96.9% 0.016 293.756)", false],
  ["--color-violet-100", "oklch(94.3% 0.029 294.588)", false],
  ["--color-violet-200", "oklch(89.4% 0.057 293.283)", false],
  ["--color-violet-300", "oklch(81.1% 0.111 293.571)", false],
  ["--color-violet-400", "oklch(70.2% 0.183 293.541)", false],
  ["--color-violet-500", "oklch(60.6% 0.25 292.717)", false],
  ["--color-violet-600", "oklch(54.1% 0.281 293.009)", false],
  ["--color-violet-700", "oklch(49.1% 0.27 292.581)", false],
  ["--color-violet-800", "oklch(43.2% 0.232 292.759)", false],
  ["--color-violet-900", "oklch(38% 0.189 293.745)", false],
  ["--color-violet-950", "oklch(28.3% 0.141 291.089)", false],
  ["--color-purple-50", "oklch(97.7% 0.014 308.299)", false],
  ["--color-purple-100", "oklch(94.6% 0.033 307.174)", false],
  ["--color-purple-200", "oklch(90.2% 0.063 306.703)", false],
  ["--color-purple-300", "oklch(82.7% 0.119 306.383)", false],
  ["--color-purple-400", "oklch(71.4% 0.203 305.504)", false],
  ["--color-purple-500", "oklch(62.7% 0.265 303.9)", false],
  ["--color-purple-600", "oklch(55.8% 0.288 302.321)", false],
  ["--color-purple-700", "oklch(49.6% 0.265 301.924)", false],
  ["--color-purple-800", "oklch(43.8% 0.218 303.724)", false],
  ["--color-purple-900", "oklch(38.1% 0.176 304.987)", false],
  ["--color-purple-950", "oklch(29.1% 0.149 302.717)", false],
  ["--color-fuchsia-50", "oklch(97.7% 0.017 320.058)", false],
  ["--color-fuchsia-100", "oklch(95.2% 0.037 318.852)", false],
  ["--color-fuchsia-200", "oklch(90.3% 0.076 319.62)", false],
  ["--color-fuchsia-300", "oklch(83.3% 0.145 321.434)", false],
  ["--color-fuchsia-400", "oklch(74% 0.238 322.16)", false],
  ["--color-fuchsia-500", "oklch(66.7% 0.295 322.15)", false],
  ["--color-fuchsia-600", "oklch(59.1% 0.293 322.896)", false],
  ["--color-fuchsia-700", "oklch(51.8% 0.253 323.949)", false],
  ["--color-fuchsia-800", "oklch(45.2% 0.211 324.591)", false],
  ["--color-fuchsia-900", "oklch(40.1% 0.17 325.612)", false],
  ["--color-fuchsia-950", "oklch(29.3% 0.136 325.661)", false],
  ["--color-pink-50", "oklch(97.1% 0.014 343.198)", false],
  ["--color-pink-100", "oklch(94.8% 0.028 342.258)", false],
  ["--color-pink-200", "oklch(89.9% 0.061 343.231)", false],
  ["--color-pink-300", "oklch(82.3% 0.12 346.018)", false],
  ["--color-pink-400", "oklch(71.8% 0.202 349.761)", false],
  ["--color-pink-500", "oklch(65.6% 0.241 354.308)", false],
  ["--color-pink-600", "oklch(59.2% 0.249 0.584)", false],
  ["--color-pink-700", "oklch(52.5% 0.223 3.958)", false],
  ["--color-pink-800", "oklch(45.9% 0.187 3.815)", false],
  ["--color-pink-900", "oklch(40.8% 0.153 2.432)", false],
  ["--color-pink-950", "oklch(28.4% 0.109 3.907)", false],
  ["--color-rose-50", "oklch(96.9% 0.015 12.422)", false],
  ["--color-rose-100", "oklch(94.1% 0.03 12.58)", false],
  ["--color-rose-200", "oklch(89.2% 0.058 10.001)", false],
  ["--color-rose-300", "oklch(81% 0.117 11.638)", false],
  ["--color-rose-400", "oklch(71.2% 0.194 13.428)", false],
  ["--color-rose-500", "oklch(64.5% 0.246 16.439)", false],
  ["--color-rose-600", "oklch(58.6% 0.253 17.585)", false],
  ["--color-rose-700", "oklch(51.4% 0.222 16.935)", false],
  ["--color-rose-800", "oklch(45.5% 0.188 13.697)", false],
  ["--color-rose-900", "oklch(41% 0.159 10.272)", false],
  ["--color-rose-950", "oklch(27.1% 0.105 12.094)", false],
  ["--color-slate-50", "oklch(98.4% 0.003 247.858)", false],
  ["--color-slate-100", "oklch(96.8% 0.007 247.896)", false],
  ["--color-slate-200", "oklch(92.9% 0.013 255.508)", false],
  ["--color-slate-300", "oklch(86.9% 0.022 252.894)", false],
  ["--color-slate-400", "oklch(70.4% 0.04 256.788)", false],
  ["--color-slate-500", "oklch(55.4% 0.046 257.417)", false],
  ["--color-slate-600", "oklch(44.6% 0.043 257.281)", false],
  ["--color-slate-700", "oklch(37.2% 0.044 257.287)", false],
  ["--color-slate-800", "oklch(27.9% 0.041 260.031)", false],
  ["--color-slate-900", "oklch(20.8% 0.042 265.755)", false],
  ["--color-slate-950", "oklch(12.9% 0.042 264.695)", false],
  ["--color-gray-50", "oklch(98.5% 0.002 247.839)", false],
  ["--color-gray-100", "oklch(96.7% 0.003 264.542)", false],
  ["--color-gray-200", "oklch(92.8% 0.006 264.531)", false],
  ["--color-gray-300", "oklch(87.2% 0.01 258.338)", false],
  ["--color-gray-400", "oklch(70.7% 0.022 261.325)", false],
  ["--color-gray-500", "oklch(55.1% 0.027 264.364)", false],
  ["--color-gray-600", "oklch(44.6% 0.03 256.802)", false],
  ["--color-gray-700", "oklch(37.3% 0.034 259.733)", false],
  ["--color-gray-800", "oklch(27.8% 0.033 256.848)", false],
  ["--color-gray-900", "oklch(21% 0.034 264.665)", false],
  ["--color-gray-950", "oklch(13% 0.028 261.692)", false],
  ["--color-zinc-50", "oklch(98.5% 0 0)", false],
  ["--color-zinc-100", "oklch(96.7% 0.001 286.375)", false],
  ["--color-zinc-200", "oklch(92% 0.004 286.32)", false],
  ["--color-zinc-300", "oklch(87.1% 0.006 286.286)", false],
  ["--color-zinc-400", "oklch(70.5% 0.015 286.067)", false],
  ["--color-zinc-500", "oklch(55.2% 0.016 285.938)", false],
  ["--color-zinc-600", "oklch(44.2% 0.017 285.786)", false],
  ["--color-zinc-700", "oklch(37% 0.013 285.805)", false],
  ["--color-zinc-800", "oklch(27.4% 0.006 286.033)", false],
  ["--color-zinc-900", "oklch(21% 0.006 285.885)", false],
  ["--color-zinc-950", "oklch(14.1% 0.005 285.823)", false],
  ["--color-neutral-50", "oklch(98.5% 0 0)", false],
  ["--color-neutral-100", "oklch(97% 0 0)", false],
  ["--color-neutral-200", "oklch(92.2% 0 0)", false],
  ["--color-neutral-300", "oklch(87% 0 0)", false],
  ["--color-neutral-400", "oklch(70.8% 0 0)", false],
  ["--color-neutral-500", "oklch(55.6% 0 0)", false],
  ["--color-neutral-600", "oklch(43.9% 0 0)", false],
  ["--color-neutral-700", "oklch(37.1% 0 0)", false],
  ["--color-neutral-800", "oklch(26.9% 0 0)", false],
  ["--color-neutral-900", "oklch(20.5% 0 0)", false],
  ["--color-neutral-950", "oklch(14.5% 0 0)", false],
  ["--color-stone-50", "oklch(98.5% 0.001 106.423)", false],
  ["--color-stone-100", "oklch(97% 0.001 106.424)", false],
  ["--color-stone-200", "oklch(92.3% 0.003 48.717)", false],
  ["--color-stone-300", "oklch(86.9% 0.005 56.366)", false],
  ["--color-stone-400", "oklch(70.9% 0.01 56.259)", false],
  ["--color-stone-500", "oklch(55.3% 0.013 58.071)", false],
  ["--color-stone-600", "oklch(44.4% 0.011 73.639)", false],
  ["--color-stone-700", "oklch(37.4% 0.01 67.558)", false],
  ["--color-stone-800", "oklch(26.8% 0.007 34.298)", false],
  ["--color-stone-900", "oklch(21.6% 0.006 56.043)", false],
  ["--color-stone-950", "oklch(14.7% 0.004 49.25)", false],
  ["--color-black", "#000", false],
  ["--color-white", "#fff", false],
  ["--spacing", "0.25rem", false],
  ["--breakpoint-sm", "40rem", false],
  ["--breakpoint-md", "48rem", false],
  ["--breakpoint-lg", "64rem", false],
  ["--breakpoint-xl", "80rem", false],
  ["--breakpoint-2xl", "96rem", false],
  ["--container-3xs", "16rem", false],
  ["--container-2xs", "18rem", false],
  ["--container-xs", "20rem", false],
  ["--container-sm", "24rem", false],
  ["--container-md", "28rem", false],
  ["--container-lg", "32rem", false],
  ["--container-xl", "36rem", false],
  ["--container-2xl", "42rem", false],
  ["--container-3xl", "48rem", false],
  ["--container-4xl", "56rem", false],
  ["--container-5xl", "64rem", false],
  ["--container-6xl", "72rem", false],
  ["--container-7xl", "80rem", false],
  ["--text-xs", "0.75rem", false],
  ["--text-xs--line-height", "calc(1 / 0.75)", false],
  ["--text-sm", "0.875rem", false],
  ["--text-sm--line-height", "calc(1.25 / 0.875)", false],
  ["--text-base", "1rem", false],
  ["--text-base--line-height", "calc(1.5 / 1)", false],
  ["--text-lg", "1.125rem", false],
  ["--text-lg--line-height", "calc(1.75 / 1.125)", false],
  ["--text-xl", "1.25rem", false],
  ["--text-xl--line-height", "calc(1.75 / 1.25)", false],
  ["--text-2xl", "1.5rem", false],
  ["--text-2xl--line-height", "calc(2 / 1.5)", false],
  ["--text-3xl", "1.875rem", false],
  ["--text-3xl--line-height", "calc(2.25 / 1.875)", false],
  ["--text-4xl", "2.25rem", false],
  ["--text-4xl--line-height", "calc(2.5 / 2.25)", false],
  ["--text-5xl", "3rem", false],
  ["--text-5xl--line-height", "1", false],
  ["--text-6xl", "3.75rem", false],
  ["--text-6xl--line-height", "1", false],
  ["--text-7xl", "4.5rem", false],
  ["--text-7xl--line-height", "1", false],
  ["--text-8xl", "6rem", false],
  ["--text-8xl--line-height", "1", false],
  ["--text-9xl", "8rem", false],
  ["--text-9xl--line-height", "1", false],
  ["--font-weight-thin", "100", false],
  ["--font-weight-extralight", "200", false],
  ["--font-weight-light", "300", false],
  ["--font-weight-normal", "400", false],
  ["--font-weight-medium", "500", false],
  ["--font-weight-semibold", "600", false],
  ["--font-weight-bold", "700", false],
  ["--font-weight-extrabold", "800", false],
  ["--font-weight-black", "900", false],
  ["--tracking-tighter", "-0.05em", false],
  ["--tracking-tight", "-0.025em", false],
  ["--tracking-normal", "0em", false],
  ["--tracking-wide", "0.025em", false],
  ["--tracking-wider", "0.05em", false],
  ["--tracking-widest", "0.1em", false],
  ["--leading-tight", "1.25", false],
  ["--leading-snug", "1.375", false],
  ["--leading-normal", "1.5", false],
  ["--leading-relaxed", "1.625", false],
  ["--leading-loose", "2", false],
  ["--radius-xs", "0.125rem", false],
  ["--radius-sm", "0.25rem", false],
  ["--radius-md", "0.375rem", false],
  ["--radius-lg", "0.5rem", false],
  ["--radius-xl", "0.75rem", false],
  ["--radius-2xl", "1rem", false],
  ["--radius-3xl", "1.5rem", false],
  ["--radius-4xl", "2rem", false],
  ["--shadow-2xs", "0 1px rgb(0 0 0 / 0.05)", false],
  ["--shadow-xs", "0 1px 2px 0 rgb(0 0 0 / 0.05)", false],
  ["--shadow-sm", "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)", false],
  ["--shadow-md", "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)", false],
  ["--shadow-lg", "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)", false],
  ["--shadow-xl", "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)", false],
  ["--shadow-2xl", "0 25px 50px -12px rgb(0 0 0 / 0.25)", false],
  ["--inset-shadow-2xs", "inset 0 1px rgb(0 0 0 / 0.05)", false],
  ["--inset-shadow-xs", "inset 0 1px 1px rgb(0 0 0 / 0.05)", false],
  ["--inset-shadow-sm", "inset 0 2px 4px rgb(0 0 0 / 0.05)", false],
  ["--drop-shadow-xs", "0 1px 1px rgb(0 0 0 / 0.05)", false],
  ["--drop-shadow-sm", "0 1px 2px rgb(0 0 0 / 0.15)", false],
  ["--drop-shadow-md", "0 3px 3px rgb(0 0 0 / 0.12)", false],
  ["--drop-shadow-lg", "0 4px 4px rgb(0 0 0 / 0.15)", false],
  ["--drop-shadow-xl", "0 9px 7px rgb(0 0 0 / 0.1)", false],
  ["--drop-shadow-2xl", "0 25px 25px rgb(0 0 0 / 0.15)", false],
  ["--text-shadow-2xs", "0px 1px 0px rgb(0 0 0 / 0.15)", false],
  ["--text-shadow-xs", "0px 1px 1px rgb(0 0 0 / 0.2)", false],
  [
    "--text-shadow-sm",
    "0px 1px 0px rgb(0 0 0 / 0.075), 0px 1px 1px rgb(0 0 0 / 0.075), 0px 2px 2px rgb(0 0 0 / 0.075)",
    false,
  ],
  [
    "--text-shadow-md",
    "0px 1px 1px rgb(0 0 0 / 0.1), 0px 1px 2px rgb(0 0 0 / 0.1), 0px 2px 4px rgb(0 0 0 / 0.1)",
    false,
  ],
  [
    "--text-shadow-lg",
    "0px 1px 2px rgb(0 0 0 / 0.1), 0px 3px 2px rgb(0 0 0 / 0.1), 0px 4px 8px rgb(0 0 0 / 0.1)",
    false,
  ],
  ["--ease-in", "cubic-bezier(0.4, 0, 1, 1)", false],
  ["--ease-out", "cubic-bezier(0, 0, 0.2, 1)", false],
  ["--ease-in-out", "cubic-bezier(0.4, 0, 0.2, 1)", false],
  ["--animate-spin", "spin 1s linear infinite", false],
  ["--animate-ping", "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite", false],
  ["--animate-pulse", "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite", false],
  ["--animate-bounce", "bounce 1s infinite", false],
  ["--blur-xs", "4px", false],
  ["--blur-sm", "8px", false],
  ["--blur-md", "12px", false],
  ["--blur-lg", "16px", false],
  ["--blur-xl", "24px", false],
  ["--blur-2xl", "40px", false],
  ["--blur-3xl", "64px", false],
  ["--perspective-dramatic", "100px", false],
  ["--perspective-near", "300px", false],
  ["--perspective-normal", "500px", false],
  ["--perspective-midrange", "800px", false],
  ["--perspective-distant", "1200px", false],
  ["--aspect-video", "16 / 9", false],
  ["--default-transition-duration", "150ms", false],
  ["--default-transition-timing-function", "cubic-bezier(0.4, 0, 0.2, 1)", false],
  ["--default-font-family", "var(--font-sans)", false],
  ["--default-mono-font-family", "var(--font-mono)", false],
  ["--blur", "8px", true],
  ["--shadow", "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)", true],
  ["--shadow-inner", "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)", true],
  ["--drop-shadow", "0 1px 2px rgb(0 0 0 / 0.1), 0 1px 1px rgb(0 0 0 / 0.06)", true],
  ["--radius", "0.25rem", true],
  ["--max-width-prose", "65ch", true],
]

export const keyframes: ReadonlyArray<readonly [name: string, body: string]> = [
  ["spin", "to { transform: rotate(360deg); }"],
  ["ping", "75%, 100% { transform: scale(2); opacity: 0; }"],
  ["pulse", "50% { opacity: 0.5; }"],
  [
    "bounce",
    "0%, 100% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); } 50% { transform: none; animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }",
  ],
]

export const preflight = `
@layer base {
  *, ::after, ::before, ::backdrop, ::file-selector-button {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border: 0 solid;
  }
  html, :host {
    line-height: 1.5;
    -webkit-text-size-adjust: 100%;
    tab-size: 4;
    font-family: var(--default-font-family, ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji");
    font-feature-settings: var(--default-font-feature-settings, normal);
    font-variation-settings: var(--default-font-variation-settings, normal);
    -webkit-tap-highlight-color: transparent;
  }
  hr {
    height: 0;
    color: inherit;
    border-top-width: 1px;
  }
  abbr:where([title]) {
    -webkit-text-decoration: underline dotted;
    text-decoration: underline dotted;
  }
  h1, h2, h3, h4, h5, h6 {
    font-size: inherit;
    font-weight: inherit;
  }
  a {
    color: inherit;
    -webkit-text-decoration: inherit;
    text-decoration: inherit;
  }
  b, strong {
    font-weight: bolder;
  }
  code, kbd, samp, pre {
    font-family: var(--default-mono-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);
    font-feature-settings: var(--default-mono-font-feature-settings, normal);
    font-variation-settings: var(--default-mono-font-variation-settings, normal);
    font-size: 1em;
  }
  small {
    font-size: 80%;
  }
  sub, sup {
    font-size: 75%;
    line-height: 0;
    position: relative;
    vertical-align: baseline;
  }
  sub {
    bottom: -0.25em;
  }
  sup {
    top: -0.5em;
  }
  table {
    text-indent: 0;
    border-color: inherit;
    border-collapse: collapse;
  }
  :-moz-focusring {
    outline: auto;
  }
  progress {
    vertical-align: baseline;
  }
  summary {
    display: list-item;
  }
  ol, ul, menu {
    list-style: none;
  }
  img, svg, video, canvas, audio, iframe, embed, object {
    display: block;
    vertical-align: middle;
  }
  img, video {
    max-width: 100%;
    height: auto;
  }
  button, input, select, optgroup, textarea, ::file-selector-button {
    font: inherit;
    font-feature-settings: inherit;
    font-variation-settings: inherit;
    letter-spacing: inherit;
    color: inherit;
    border-radius: 0;
    background-color: transparent;
    opacity: 1;
  }
  :where(select:is([multiple], [size])) optgroup {
    font-weight: bolder;
  }
  :where(select:is([multiple], [size])) optgroup option {
    padding-inline-start: 20px;
  }
  ::file-selector-button {
    margin-inline-end: 4px;
  }
  ::placeholder {
    opacity: 1;
  }
  @supports (not (-webkit-appearance: -apple-pay-button))  or (contain-intrinsic-size: 1px) {
    ::placeholder {
      color: currentcolor;
      @supports (color: color-mix(in lab, red, red)) {
        color: color-mix(in oklab, currentcolor 50%, transparent);
      }
    }
  }
  textarea {
    resize: vertical;
  }
  ::-webkit-search-decoration {
    -webkit-appearance: none;
  }
  ::-webkit-date-and-time-value {
    min-height: 1lh;
    text-align: inherit;
  }
  ::-webkit-datetime-edit {
    display: inline-flex;
  }
  ::-webkit-datetime-edit-fields-wrapper {
    padding: 0;
  }
  ::-webkit-datetime-edit, ::-webkit-datetime-edit-year-field, ::-webkit-datetime-edit-month-field, ::-webkit-datetime-edit-day-field, ::-webkit-datetime-edit-hour-field, ::-webkit-datetime-edit-minute-field, ::-webkit-datetime-edit-second-field, ::-webkit-datetime-edit-millisecond-field, ::-webkit-datetime-edit-meridiem-field {
    padding-block: 0;
  }
  ::-webkit-calendar-picker-indicator {
    line-height: 1;
  }
  :-moz-ui-invalid {
    box-shadow: none;
  }
  button, input:where([type="button"], [type="reset"], [type="submit"]), ::file-selector-button {
    appearance: button;
  }
  ::-webkit-inner-spin-button, ::-webkit-outer-spin-button {
    height: auto;
  }
  [hidden]:where(:not([hidden="until-found"])) {
    display: none !important;
  }
}
`
