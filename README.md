# Webis.de Website Assets

This repository contains common reusable Jekyll templates and Sass
style sheets. The repository serves both as a hotlink source to
be included from `assets.webis.de` and as a repository of
boilerplate code for new service templates.

The website is built using [Jekyll](https://jekyllrb.com/docs/) and uses
[UIkit](https://getuikit.com/) as a CSS framework as well as a few additional
JavaScript libraries. To install Jekyll, UIkit, and all JavaScript dependencies
on your system, run

    sudo apt install ruby ruby-dev build-essential jekyll npm
    npm install

After Jekyll and NPM are installed, you can `cd` into the main folder of this
repository and run

    jekyll serve

Yoy can e.g. use `bundle exec jekyll serve --port 5000` for local debugging.

For more build and usage instructions, please refer to the `webis-de.github.io`
repositories' README file.


