# The "breeze-client" npm package

This is the official NPM package for the Breeze core client-side libraries. The package files are in the [breeze.server.node](https://github.com/Breeze/breeze.server.node) repository in the 'breeze-client' subfolder, which is built from the original source files in the [breeze.js](https://github.com/Breeze/breeze.js) repository.

To install with npm, open a terminal or command window and enter:

`npm install breeze-client`

>Case matters! Be sure to spell "breeze-client" in all lowercase.

[Learn more about Breeze](http://breeze.github.io/doc-js/ "breezejs").

## Structure

The most widely used Breeze client library is "breeze.debug.js". It combines both the
base Breeze functionality and the default adapters for Knockout and Angular applications.

>but not the "breeze.bridge.angular" adapter used by most Angular apps. See below.

### build

The "build" directory holds the scripts generated from the core Breeze sources.

* **breeze.debug.js** - the base client library and selected default adapters.
* **breeze.base.debug.js** - the base client library without any adapters.
* **breeze.min.js** - the minified default client library.
* **breeze.base.min.js** - the minified base client library.

It also holds the breeze adapters in a separate subdirectory.

### build/adapters
The "build/adapters" directory contains scripts for every core Breeze adapter.

Adapters implement breeze feature-extension-points for specific application environments.  For example, the "breeze.ajax.jQuery.js" script provides a jQuery implementation of
the Breeze "ajax" interface for communicating with remote services via XMLHttpRequest (XHR).

Some of these adapters (like "breeze.ajax.jQuery.js") are embedded in
"breeze.debug.js". You should not load them again if you're loading "breeze.debug.js".

Others (like "breeze.bridge.angular.js" and "breeze.modelLibrary.backbone.js") are not embedded. You will have to load these adapter scripts separately if you need their capabilities.

If you choose to run with "breeze.**base**.debug.js" instead of "breeze.debug.js", you must load *every* required adapter script separately.

## No Breeze Labs!

This package **does not include the Breeze Labs**.

[**Breeze Labs**](http://breeze.github.io/doc-breeze-labs/) are experimental libraries and not part of the Breeze core.


