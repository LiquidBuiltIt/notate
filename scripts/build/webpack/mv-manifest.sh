#!/bin/bash

SRC=$(dirname $BASH_SOURCE)
ROOT=$HOME/Projects/Web-Extensions/Quick-Notes/current
STATIC=$ROOT/src/Static
ASSETS=$ROOT/src/Assets
BROWSER_TARGET=$1
BUILD_TARGET=$2
MANIFEST=manifest.$BROWSER_TARGET.json
BUILD_DIR=$ROOT/$BUILD_TARGET/$BROWSER_TARGET

#MANIFEST_BUILDER=$ROOT/scripts/build/webpack/build-manifest.py


#build_chrome_manifest() {
#	PEM_KEY=$(sed '1d;$d' $ROOT/notate.pem)
#	MANIFEST_KEY=$(printf '{ "key" : "%s" }' \"$PEM_KEY\")
#	DEST_MANIFEST=$BUILD_DIR/manifest.json
#
#	CMD=$( jq --argjson pem "$MANIFEST_KEY" '. += $pem' $DEST_MANIFEST ) 
#
#	echo $CMD
#}

cp -r $ASSETS/. $BUILD_DIR
cp $STATIC/$MANIFEST $BUILD_DIR/manifest.json

#if [ $BROWSER_TARGET = 'chrome' ]; then 
#	python $MANIFEST_BUILDER --root $ROOT --build-dir $BUILD_DIR
#fi


