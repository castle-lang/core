const merge = require('merge2')

const gulp  = require('gulp');
const watch = require('gulp-watch');
const ts    = require('gulp-typescript');

const tsProject = ts.createProject('tsconfig.json');

gulp.task('default', () => {
  const tsResult = tsProject.src().pipe(tsProject());

  return merge([
    tsResult.dts.pipe(gulp.dest('declarations')),
    tsResult.js.pipe(gulp.dest('lib'))
  ]);
});

gulp.task('watch', () => {
  return watch('src/**/*', {verbose : true}, () => {
    tsProject.src().pipe(tsProject()).js.pipe(gulp.dest('lib'));
  });
});
