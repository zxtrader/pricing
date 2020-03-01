#!/usr/bin/env node

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });

const { launcher } = require("@zxteam/launcher");

const { default: runtimeFactory, Configuration } = require("../");

launcher(Configuration.parse, runtimeFactory);
