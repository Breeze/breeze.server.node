// Build for breeze.server.node-breeze-client

var gulp    = require('gulp');
var changed = require('gulp-changed');
var shell   = require('gulp-shell')

var eventStream = require('event-stream');

var dest = './'

var _clientDir = '../../../breeze.js/'
var _clientSrcDir =  _clientDir + 'src/'
var _clientBuildDir = _clientDir + 'build/';

// run the breezejs build process - which updates the _clientBuildDir
gulp.task('buildBreeze', shell.task('gulp', { cwd: _clientBuildDir }))

// copy the lastest breeze.debug.js
gulp.task('getBreeze', [], function() {

  eventStream.concat(
    // copy all breeze files with preexisting structure into build
    gulp.src( [_clientBuildDir + 'breeze.*', _clientBuildDir + 'adapters/*.*', _clientBuildDir + 'typings/*.d.ts'], { base: _clientBuildDir })
      .pipe(changed(dest))
      .pipe(gulp.dest(dest)),
    // copy breeze scripts and index.d.ts to the parent of this dir ( i.e. from './build' to './' )
    gulp.src( [_clientBuildDir + 'breeze.*.js', _clientBuildDir + 'adapters/*.*', _clientBuildDir + 'typings/index.d.ts' ])
      .pipe(changed('..'))
      .pipe(gulp.dest('..'))
  );

});

gulp.task('default', ['getBreeze'], function() {

});