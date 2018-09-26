/* https://github.com/substack/minimist */

// @flow
/* eslint-disable max-len, dot-notation, no-continue, no-plusplus, prefer-spread, require-jsdoc, jsdoc/require-description-complete-sentence, unicorn/prefer-starts-ends-with */

type Opts = {
  string?: string | Array<string>, //* argument names to always treat as strings
  boolean?: boolean | string | Array<string>, //* always treat as booleans. if true will treat all double hyphenated arguments without equal signs as boolean (e.g. affects --foo, not -f or --foo=bar)
  alias?: { [string]: string | Array<string> }, //* argument names to use as aliases
  default?: { [string]: mixed }, //* mapping string argument names to default values
  stopEarly?: boolean, //* when true, populate argv._ with everything after the first non-option
  '--'?: boolean, //* when true, populate argv._ with everything before the -- and argv['--'] with everything after the --
  unknown?: string => boolean, //* a function which is invoked with a command line parameter not defined in the opts configuration object. If the function returns false, the unknown option is not added to argv.
}

type ArgItem = string | number | boolean | { [string]: ArgItem } | Array<ArgItem>

type ArgV = {
  [string]: ArgItem,
  _: Array<string | number>,
  '--'?: Array<string>,
}

/**
 * parse argument options
 *
 * Return an argument object argv populated with the array arguments from args.
 * argv._ contains all the arguments that didn't have an option associated with them.
 * Numeric-looking arguments will be returned as numbers unless opts.string or opts.boolean is set for that argument name.
 * Any arguments after '--' will not be parsed and will end up in argv._.
 *
 * @param args - Arguments array.
 * @param opts - Parse options.
 * @returns - argv object.
 */
export default function parseArgs (args: Array<string>, opts: Opts): ArgV {
  if (!opts) opts = {}

  const flags = {
    allBools: (undefined: ?boolean),
    bools: ({}: { [string]: boolean }),
    strings: {},
    unknownFn: (null: ?Function),
  }

  if (typeof opts['unknown'] === 'function') {
    flags.unknownFn = opts['unknown']
  }

  if (typeof opts['boolean'] !== 'boolean') {
    []
      .concat(opts['boolean'])
      .filter(Boolean)
      .forEach((key) => {
        flags.bools[key] = true
      })
  } else if (opts['boolean']) {
    flags.allBools = true
  }

  const aliases = {}
  const alias = opts.alias || {}
  Object.keys(alias).forEach((key) => {
    aliases[key] = [].concat(alias[key])
    aliases[key].forEach((x) => {
      aliases[x] = [key].concat(aliases[key].filter(y => x !== y))
    })
  });
  []
    .concat(opts.string)
    .filter(Boolean)
    .forEach((key) => {
      flags.strings[key] = true
      if (aliases[key]) {
        flags.strings[aliases[key]] = true
      }
    })

  const defaults = opts['default'] || {}

  const argv: ArgV = { _: [] }
  Object.keys(flags.bools).forEach((key) => {
    setArg(key, defaults[key] === undefined ? false : defaults[key])
  })

  let notFlags = []

  if (args.indexOf('--') !== -1) {
    notFlags = args.slice(args.indexOf('--') + 1)
    args = args.slice(0, args.indexOf('--'))
  }

  function argDefined (key, arg) {
    return (
      (flags.allBools && /^--[^=]+$/.test(arg)) ||
      flags.strings[key] ||
      flags.bools[key] ||
      aliases[key]
    )
  }

  function setArg (key, val, arg) {
    if (arg && flags.unknownFn && !argDefined(key, arg)) {
      if (flags.unknownFn(arg) === false) return
    }

    const value = !flags.strings[key] && isNumber(val) ? Number(val) : val
    setKey(argv, key.split('.'), value);
    (aliases[key] || []).forEach((x) => {
      setKey(argv, x.split('.'), value)
    })
  }

  function setKey (obj, keys, value) {
    let o: any = obj
    keys.slice(0, -1).forEach((key) => {
      if (o[key] === undefined) o[key] = {}
      o = o[key]
    })

    const key = keys[keys.length - 1]
    if (o[key] === undefined || flags.bools[key] || typeof o[key] === 'boolean') {
      o[key] = value
    } else if (Array.isArray(o[key])) {
      o[key].push(value)
    } else {
      o[key] = [o[key], value]
    }
  }

  function aliasIsBoolean (key) {
    return aliases[key].some(x => flags.bools[x])
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (/^--.+=/.test(arg)) {
      // Using [\s\S] instead of . because js doesn't support the
      // 'dotall' regex modifier. See:
      // http://stackoverflow.com/a/1068308/13216
      const m: any = arg.match(/^--([^=]+)=([\s\S]*)$/)
      const key = m[1]
      let value = m[2]
      if (flags.bools[key]) {
        value = value !== 'false'
      }
      setArg(key, value, arg)
    } else if (/^--no-.+/.test(arg)) {
      const key = (arg.match(/^--no-(.+)/): any)[1]
      setArg(key, false, arg)
    } else if (/^--.+/.test(arg)) {
      const key = (arg.match(/^--(.+)/): any)[1]
      const next = args[i + 1]
      if (
        next !== undefined &&
        !/^-/.test(next) &&
        !flags.bools[key] &&
        !flags.allBools &&
        (aliases[key] ? !aliasIsBoolean(key) : true)
      ) {
        setArg(key, next, arg)
        i++
      } else if (/^(true|false)$/.test(next)) {
        setArg(key, next === 'true', arg)
        i++
      } else {
        setArg(key, flags.strings[key] ? '' : true, arg)
      }
    } else if (/^-[^-]+/.test(arg)) {
      const letters = arg.slice(1, -1).split('')

      let broken = false
      for (let j = 0; j < letters.length; j++) {
        const next = arg.slice(j + 2)

        if (next === '-') {
          setArg(letters[j], next, arg)
          continue
        }

        if (/[A-Za-z]/.test(letters[j]) && /=/.test(next)) {
          setArg(letters[j], next.split('=')[1], arg)
          broken = true
          break
        }

        if (/[A-Za-z]/.test(letters[j]) && /-?\d+(\.\d*)?(e-?\d+)?$/.test(next)) {
          setArg(letters[j], next, arg)
          broken = true
          break
        }

        if (letters[j + 1] && letters[j + 1].match(/\W/)) {
          setArg(letters[j], arg.slice(j + 2), arg)
          broken = true
          break
        } else {
          setArg(letters[j], flags.strings[letters[j]] ? '' : true, arg)
        }
      }

      const key = arg.slice(-1)[0]
      if (!broken && key !== '-') {
        if (
          args[i + 1] &&
          !/^(-|--)[^-]/.test(args[i + 1]) &&
          !flags.bools[key] &&
          (aliases[key] ? !aliasIsBoolean(key) : true)
        ) {
          setArg(key, args[i + 1], arg)
          i++
        } else if (args[i + 1] && /true|false/.test(args[i + 1])) {
          setArg(key, args[i + 1] === 'true', arg)
          i++
        } else {
          setArg(key, flags.strings[key] ? '' : true, arg)
        }
      }
    } else {
      if (!flags.unknownFn || flags.unknownFn(arg) !== false) {
        argv._.push(flags.strings['_'] || !isNumber(arg) ? arg : Number(arg))
      }
      if (opts.stopEarly) {
        argv._.push.apply(argv._, args.slice(i + 1))
        break
      }
    }
  }

  Object.keys(defaults).forEach((key) => {
    if (!hasKey(argv, key.split('.'))) {
      setKey(argv, key.split('.'), defaults[key]);
      (aliases[key] || []).forEach((x) => {
        setKey(argv, x.split('.'), defaults[key])
      })
    }
  })

  if (opts['--']) {
    argv['--'] = []
    notFlags.forEach((key) => {
      // $FlowFixMe just set it to Array() two lines above
      argv['--'].push(key)
    })
  } else {
    notFlags.forEach((key) => {
      argv._.push(key)
    })
  }

  return argv
}

function hasKey (obj, keys) {
  let o: any = obj
  keys.slice(0, -1).forEach((key) => {
    o = (typeof o === 'object' && o[key]) || {}
  })

  const key = keys[keys.length - 1]
  return key in o
}

function isNumber (x) {
  if (typeof x === 'number') return true
  if (typeof x !== 'string') return false
  if (/^0x[0-9a-f]+$/i.test(x)) return true
  return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(x)
}
