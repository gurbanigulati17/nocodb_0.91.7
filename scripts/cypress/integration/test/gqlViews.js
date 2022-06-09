let t0 = require("./explicitLogin");
let t01 = require("../common/00_pre_configurations");
let t4a = require("../common/4a_table_view_grid_gallery_form");
let t4b = require("../common/4b_table_view_share");
let t4c = require("../common/4c_form_view_detailed");
let t4d = require("../common/4d_table_view_grid_locked");
let t4e = require("../common/4e_form_view_share");
let t4f = require("../common/4f_grid_view_share");
const {
    setCurrentMode,
} = require("../../support/page_objects/projectConstants");

// use 0 as mode to execute individual files (debug mode, skip pre-configs)
// use 1 mode if noco.db doesnt contain user credentials (full run over GIT)
const executionMode = 1;

const nocoTestSuite = (apiType, dbType) => {
    setCurrentMode(apiType, dbType);
    if (0 == executionMode) {
        t0.genTest(apiType, dbType);
    } else {
        t01.genTest(apiType, dbType);
    }

    t4a.genTest(apiType, dbType);
    t4b.genTest(apiType, dbType);
    t4c.genTest(apiType, dbType);
    t4d.genTest(apiType, dbType);
    t4e.genTest(apiType, dbType);
    t4f.genTest(apiType, dbType);
};

nocoTestSuite("graphql", "mysql");

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Raju Udava <sivadstala@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
