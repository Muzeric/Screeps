var roleClaimer = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if(!creep.memory.controllerName || !Game.flags[creep.memory.controllerName]) {
            let controllers = _.filter(Game.flags, f => 
                f.name.substring(0, 10) == 'Controller'
            );
	        if(!controllers.length) {
                //console.log(creep.name + " found no flags");
                creep.moveTo(Game.spawns[creep.memory.spawnName].room.controller);
                return;
            }
            console.log(creep.name + " controllers: " + controllers);
            
            creep.memory.controllerName = controllers.sort( function(a,b) {
                let suma = 0;
                let sumb = 0;
                for (let cr of _.filter(Game.creeps, c => c.memory.role == "claimer" && c.memory.controllerName == a.name))
                    suma += cr.ticksToLive;
                for (let cr of _.filter(Game.creeps, c => c.memory.role == "claimer" && c.memory.controllerName == b.name))
                    sumb += cr.ticksToLive;
                return suma - sumb;
            })[0].name;
            console.log("ControllerName for " + creep.name + " is " + creep.memory.controllerName);
        }
        
        if(creep.room.name == Game.flags[creep.memory.controllerName].pos.roomName) {
            if(
            (Game.flags[creep.memory.controllerName].memory.claim && creep.claimController(creep.room.controller) == ERR_NOT_IN_RANGE) ||
            (creep.reserveController(creep.room.controller) == ERR_NOT_IN_RANGE)
            ) {
                //creep.moveTo(creep.room.controller);
                creep.moveTo(Game.flags[creep.memory.controllerName].pos);
            }
        } else {
            creep.moveTo(Game.flags[creep.memory.controllerName].pos);
            //console.log(creep.name + " going to " + creep.memory.energyName + " to " + exitDir);
        }
	},
	
    create: function(spawnName, role, total_energy) {
	    let spawn = Game.spawns[spawnName];
        if(!spawn) {
            console.log("No spawn with name=" + spawnName);
            return;
        }
        console.log("total_energy:" + total_energy);
        total_energy -= 600*2 + 100;
        let body = [CLAIM,CLAIM,MOVE,MOVE];

	    let newName = spawn.createCreep(body, role + "." + Math.random().toFixed(2), {role: role, spawnName: spawnName});
	    return [newName, body, total_energy];
	}
};

module.exports = roleClaimer;