const _ = require('lodash')
const gulp = require('gulp')
const watch = require('gulp-watch')
const plumber = require('gulp-plumber')
const through = require('through2')
const jsyaml = require('js-yaml')
const PluginError = require('gulp-util').PluginError
const fs = require('graceful-fs')
const del = require('del')
const swig = require('gulp-swig')
const data = require('gulp-data')
const path = require('path')
const co = require('co')

const source = ['./templates/**/*.yaml', '!./templates/**/_*', '!./templates/**/_*/**/*.*']
const nss = ['./ns.*']
const envs = ['./env.*']
const configs_folder = './configs'
const watchFiles = ['./config.yaml', `${configs_folder}/**`].concat(envs).concat(nss).concat(source)

function cleanupYaml() {
    return through.obj((file, encoding, cb) => {
        try {
            let files = file.contents.toString().split(/\n---\n/).filter(i => i)
            let cleans = files.map(content => jsyaml.safeDump(jsyaml.safeLoad(content)))
            let clean = cleans.join('\n---\n')
            file.contents = new Buffer(clean)
            cb(null, file)
        } catch (err) {
            cb(new PluginError('cleanupYaml', `${err.message}\non file ${file.path}`))
        }
    })
}

function loadYaml(path) {
    try {
        return jsyaml.safeLoad(fs.readFileSync(path, 'utf8'))
    } catch(err) {
        console.error(err.message)
        return null
    }
}

function compile() {
    co(function*() {
        let config = loadYaml('config.yaml')
        yield del('./dist')

        for (env in config.clusters) {
            let cluster = config.clusters[env]
            try {
                let namespaces = _.keys(cluster.namespaces)
                for (ns in cluster.namespaces) {
                    try {
                        let env_files = (cluster.env_files || [`${configs_folder}/env.${env}.yaml`]).concat(cluster.namespaces[ns].env_files || [`${configs_folder}/ns.${ns}.yaml`])
                        let env_files_jsons = env_files.map(f => loadYaml(f) || {})
                        let nsJson = _.defaults.apply(_, env_files_jsons.reverse())
                        let templates = cluster.namespaces[ns].templates
                        templates = templates.reduce((acc, next) => {
                            let glob
                            if (/\.(yaml|yml)$/.test(next)) {
                                glob = `./templates/${next}`
                            } else if (/^!/.test(next)) {
                                glob = next.replace(/^!(\*\/)*/, '!*/')
                                if (!/\*$/.test(glob)) glob = glob.replace(/\/{0,1}$/, '/**/*.*')
                            } else {
                                glob = `./templates/${next}/**/*.yaml`
                            }
                            acc.push(glob)
                            return acc
                        }, [])
                        templates.push(`!./templates/**/_*`, `!./templates/**/_*/**/*.*`)
                        nsJson._namespace_ = nsJson._ns_ = ns
                        nsJson._namespaces_ = namespaces
                        nsJson._env_ = env
                        let dest = `./dist/${env}/${ns}/`
                        gulp.src(templates, {
                                base: 'templates'
                            })
                            .pipe(plumber())
                            .pipe(data(nsJson))
                            .pipe(swig({
                                setup: (swig) => {
                                    swig.setFilter('keys', (input) => _.keys(input))
                                    swig.setFilter('base64encode', (input) => new Buffer(input).toString('base64'))
                                    swig.setFilter('base64decode', (input) => new Buffer(input, 'base64').toString('utf8'))
                                    swig.setFilter('iif', (condition, ifTrue, ifFalse) => (condition ? ifTrue : ifFalse))
                                },
                                defaults: {
                                    autoescape: false,
                                    cache: false
                                },
                                ext: '.yaml'
                            }))
                            .pipe(cleanupYaml())
                            .pipe(gulp.dest(dest))
                    } catch (err) {
                        console.error(err.message)
                    }
                }
            } catch (err) {
                console.error(err.message)
            }
        }
    })
}
gulp.task('compile', compile)

gulp.task('watch', () => {
    gulp.watch(watchFiles, ['compile'])
})

gulp.task('default', ['watch'])