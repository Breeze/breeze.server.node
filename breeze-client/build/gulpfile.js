var gulp    = require('gulp');
var changed = require('gulp-changed');
var shell   = require('gulp-shell')

// currently in \breeze.server.node\breeze-client\build\gulp
var pathToBreezeBuilds = '../../../breeze.js/build/';

var pathToBreezeJs = pathToBreezeBuilds + 'breeze.debug.js';
var dest = '../'

gulp.task('buildBreeze', shell.task('gulp', { cwd: pathToBreezeBuilds }))

// copy the lastest breeze.debug.js
gulp.task('getBreeze', ['buildBreeze'], function() {
  gulp.src(pathToBreezeJs)
    .pipe(changed(dest))
    .pipe(gulp.dest(dest));
}); 

gulp.task('default', ['getBreeze'], function() {

});      