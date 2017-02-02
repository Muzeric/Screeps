var utils = require('utils');

var roleBuilder = {
    run: function(creep) {
        if (!utils.checkInRoomAndGo(creep))
            return;

	    if(creep.memory.building && creep.carry.energy == 0) {
            creep.memory.building = false;
            creep.memory.rt = null;
	    }
	    if(!creep.memory.building && creep.carry.energy == creep.carryCapacity) {
	        creep.memory.building = true;
	        creep.memory.errors = 0;
	        creep.memory.energyID = null;
	    }

	    if(creep.memory.building) {
	        var target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
            if(target) {
                creep.memory.rt = null;
                if(creep.build(target) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target);
                    creep.say("bld " +  target.pos.x + "," + target.pos.y);
                }
            } else {
                var rt = Game.getObjectById(creep.memory.rt);
                if (rt && rt.hits == rt.hitsMax || !rt) {
                        //console.log(creep.name + " repaired rt " + rt.pos.x + "," + rt.pos.y);
                        rt = reset_rt(creep);
                }
                if(rt) {
                    if(creep.repair(rt) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(rt);
                        creep.say("rpr " + rt.pos.x + "," + rt.pos.y);
                    }
                }
            }
	    }
	    else {
	        utils.findSourceAndGo(creep, 1);
	    }
	},
	
	create: function(energy) {
        let body = [];
	    while (energy >= 50 && body.length < 50) {
	        if(energy >= 50) {
	            body.push(MOVE);
	            energy -= 50;
	        }
	        if(energy >= 100 && body.length < 50) {
	            body.push(WORK);
	            energy -= 100;
	        }
	        if(energy >= 50 && body.length < 50) {
	            body.push(CARRY);
	            energy -= 50;
	        }
	    }
	    return [body, energy];
	},
};

function reset_rt (creep) {
    if(_.some(creep.room.find(FIND_STRUCTURES, {filter : s => s.structureType == STRUCTURE_TOWER})))
        return null;
    let repairLimit = utils.roomConfig[creep.room.name] ? utils.roomConfig[creep.room.name].repairLimit : 100000;
    var targets = creep.room.find(FIND_STRUCTURES, { filter: (structure) => structure.hits < structure.hitsMax*0.9 && structure.hits < repairLimit } );
    if(targets.length) {
        var rand = Math.floor(Math.random() * 5) % targets.length;
        var rt = targets.sort(function (a,b) { return (a.hits - b.hits) || (a.hits/a.hitsMax - b.hits/b.hitsMax); })[0];
        creep.memory.rt = rt.id;
        return rt;
    }
    
    return null;
}

module.exports = roleBuilder;