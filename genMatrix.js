'use strict';
const path = require('path');
const fs = require('fs');

const testFiles = [
  'genMatrix.js',
  '.github/workflows/build-test.yml',
  'compose.yml',
];

const rcDirRegex = /^\d+\.\d+$/;

const areTestFilesChanged = (changedFiles) => changedFiles
  .some((file) => testFiles.includes(file) || file.includes('templates/'));

// Returns a list of the child directories in the given path
const getChildDirectories = (parent) => fs.readdirSync(parent, { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory())
  .map(({ name }) => path.resolve(parent, name));

const getRocketChatVersionDirs = (base) => getChildDirectories(base)
  .filter((childPath) => rcDirRegex.test(path.basename(childPath)));

// Returns the paths of Dockerfiles that are at: base/*/Dockerfile
const getDockerfilesInChildDirs = (base) => path.resolve(base, 'Dockerfile');

const getAllDockerfiles = (base) => getRocketChatVersionDirs(base)
  .flatMap(getDockerfilesInChildDirs);

const getAffectedDockerfiles = (filesAdded, filesModified, filesRenamed) => {
  const files = [
    ...filesAdded,
    ...filesModified,
    ...filesRenamed,
  ];

  // If the test files were changed, include everything
  if (areTestFilesChanged(files)) {
    console.log('Test files changed so scheduling all Dockerfiles');
    return getAllDockerfiles(__dirname);
  }

  return files.filter((file) => file.endsWith('/Dockerfile'));
};

const getFullRocketChatVersionFromDockerfile = (file) => fs.readFileSync(file, 'utf8')
  .match(/^ENV RC_VERSION=(\d*\.*\d*\.\d*)/m)[1];

const getDockerfileMatrixEntry = (file) => {
  const version = getFullRocketChatVersionFromDockerfile(file);

  return {
    version,
  };
};

const generateBuildMatrix = (filesAdded, filesModified, filesRenamed) => {
  const dockerfiles = [...new Set(getAffectedDockerfiles(filesAdded, filesModified, filesRenamed))];

  const entries = dockerfiles.map(getDockerfileMatrixEntry);

  // Include runner architecture in build matrix
  const builds = [
      {platform: 'linux/amd64', runner: 'ubuntu-latest'},
      {platform: 'linux/arm64', runner: 'ubuntu-24.04-arm'}
  ];
  const expandedEntries = entries.flatMap(entry =>
    builds.map(build => ({ ...entry, ...build }))
  );

  // Return null if there are no entries so we can skip the matrix step
  return expandedEntries.length
    ? { include: expandedEntries }
    : null;
};

module.exports = generateBuildMatrix;
