var gulp=require('gulp');
var changed=require('gulp-changed');

// currently in \breeze.server.node\breeze-client\build\gulp
var pathToBreezeBuilds = '../../../../breeze.js/build/';
var pathToBreezeJs = pathToBreezeBuilds + 'breeze.debug.js';
var dest = '../../'

// copy the lastest breeze.debug.js
gulp.task('getBreeze', function() {
  gulp.src(pathToBreezeJs)
    .pipe(changed(dest))
    .pipe(gulp.dest(dest));
});

gulp.task('default', ['getBreeze'], function() {

});      