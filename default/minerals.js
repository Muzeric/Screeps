var utils = require('utils');
const profiler = require('screeps-profiler');

var minerals = {
    library : {},

    init: function () {
        for (let el1 in REACTIONS)
            for (let el2 in REACTIONS)
                this.library[REACTIONS[el1][el2]] = {
                    elems: [el1, el2],
                };
    },



};

module.exports = minerals;
profiler.registerObject(minerals, 'Minerals');