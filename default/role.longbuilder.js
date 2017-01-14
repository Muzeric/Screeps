var utils = require('utils');

var roleLongBuilder = {

    /** @param {Creep} creep **/
    run: function(creep) {
	    if(creep.memory.building && creep.carry.energy == 0) {
            creep.memory.building = false;
            creep.memory.rt = null;
            if(creep.ticksToLive < 70) {
	            console.log(creep.name + " is going to die!");
	            creep.suicide();
	        }
	    }
	    if(!creep.memory.building && creep.carry.energy == creep.carryCapacity) {
	        creep.memory.building = true;
	        creep.memory.errors = 0;
	        creep.memory.energyID = null;
	        //reset_rt(creep);
	    }

	    if(creep.memory.building) {
            let builds = _.filter(Game.flags, f => f.name.substring(0, 5) == 'Build');
	        if(builds.length) {
	            for(let buildf of builds) {
	                target = buildf.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
	                if(target)
	                    break;
	            }
	        }
            if(target) {
                if(creep.build(target) == ERR_NOT_IN_RANGE) {
                    var res = creep.moveTo(target);
                    //console.log(creep.name + " go res=" + res);
                    if(res == ERR_NO_PATH) {
                        creep.memory.errors++;
                    } else if (res == OK) {
                        creep.memory.errors = 0;
                    }
                    creep.say((target.pos.roomName == creep.pos.roomName ? "" : "chr:") +  target.pos.x + "," + target.pos.y);
                }
            }
            
            /*else {
                var rt = Game.getObjectById(creep.memory.rt);
                if (rt && rt.hits == rt.hitsMax || !rt) {
                        //console.log(creep.name + " repaired rt " + rt.pos.x + "," + rt.pos.y);
                        rt = reset_rt(creep);
                }
                if(rt) {
                    if(creep.repair(rt) == ERR_NOT_IN_RANGE) {
                        var res = creep.moveTo(rt);
                        //console.log(creep.name + " go res=" + res);
                        if(res == ERR_NO_PATH) {
                            creep.memory.errors++;
                        } else if (res == OK) {
                            creep.memory.errors = 0;
                        }
                        creep.say("rpr " + rt.pos.x + "," + rt.pos.y);
                    }
                }
            }*/
	    }
	    else {
	        if(!creep.memory.energyID) {
	            creep.memory.energyID = utils.findSource(creep);
	        }
            utils.gotoSource(creep);
	    }
	},
	
	create: function(spawnName, role, total_energy) {
	    let spawn = Game.spawns[spawnName];
        if(!spawn) {
            console.log("No spawn with name=" + spawnName);
            return;
        }
        console.log("total_energy:" + total_energy);
        let body = [];
	    while (total_energy >= 50) {
	        if(total_energy >= 50) {
	            body.push(MOVE);
	            total_energy -= 50;
	        }
	        if(total_energy >= 100) {
	            body.push(WORK);
	            total_energy -= 100;
	        }
	        if(total_energy >= 50) {
	            body.push(MOVE);
	            total_energy -= 50;
	        }
	        if(total_energy >= 50) {
	            body.push(CARRY);
	            total_energy -= 50;
	        }
	    }
	    let newName = spawn.createCreep(body, role + "." + Math.random().toFixed(2), {role: role, spawnName: spawnName});
        console.log("Born by " + spawnName + " creep " + newName + " (" + body + ")");
	}
};

function reset_rt (creep) {
    var targets = creep.room.find(FIND_STRUCTURES, { filter: (structure) => structure.hits < structure.hitsMax*0.9 } );
    if(targets.length) {
        var rand = Math.floor(Math.random() * 5) % targets.length;
        var rt = targets.sort(function (a,b) { return (a.hits - b.hits) || (a.hits/a.hitsMax - b.hits/b.hitsMax); })[rand];
        creep.memory.rt = rt.id;
        return rt;
    }
    
    return null;
}

module.exports = roleLongBuilder;