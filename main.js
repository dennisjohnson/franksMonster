// profiler - Your main.js will will need to be configured like so.

// Any modules that you use that modify the game's prototypes should be require'd
// before you require the profiler.
const profiler = require('screeps-profiler');

// This line monkey patches the global prototypes.
profiler.enable();


let roomLayout = profiler.registerObject(require('roomLayout'), 'roomLayout');
let harvesterIncome = require('source.harvesting');


module.exports.loop = function() {
    profiler.wrap(loop)};

function loop(){
    roomLayout.run();

    let spawnNames = Object.keys(Game.spawns);
    if (spawnNames.length === 0) { return }
    let firstSpawn = Game.spawns[spawnNames[0]];
    let name;

    let controllerWorkSpot = new RoomPosition(9,31, firstSpawn.room.name);
    let energyPickupSpot = new RoomPosition(44,5, firstSpawn.room.name);
    let energyDropoffSpot = new RoomPosition(10,30, firstSpawn.room.name);

    if (Memory["sources"] === undefined){
        Memory["sources"] = {};
    }


    harvesterIncome.run();

    name = "Rascal";
    if (Game.creeps[name] === undefined){
        firstSpawn.createCreep([WORK,WORK,MOVE,CARRY], name);
    }
    else {
        let creep = Game.creeps[name];
        if(!_.isEqual(creep.pos, controllerWorkSpot)){
            creep.moveTo(controllerWorkSpot);
        }
        if(creep.pos.getRangeTo(controllerWorkSpot) <= 1){
            creep.upgradeController(creep.room.controller);
        }

    }

    name = "Midnight";
    if (Game.creeps[name] === undefined){
        firstSpawn.createCreep([MOVE,CARRY,MOVE,CARRY,MOVE,CARRY], name);
    }
    else {
        let creep = Game.creeps[name];
        if (creep.carry.energy > 0){
            if(!_.isEqual(creep.pos, energyDropoffSpot)){
                creep.moveTo(energyDropoffSpot);
            }
            if(creep.pos.getRangeTo(energyDropoffSpot) <= 1){
                creepsAtDropoff = controllerWorkSpot.lookFor(LOOK_CREEPS);
                if(creepsAtDropoff.length > 0){
                    creep.transfer(creepsAtDropoff[0], RESOURCE_ENERGY);
                }

            }

        }
        else{
            if(!_.isEqual(creep.pos, energyPickupSpot)){
                creep.moveTo(energyPickupSpot);
            }
            if(creep.pos.getRangeTo(energyPickupSpot) <= 1){
                creep.withdraw(firstSpawn, RESOURCE_ENERGY);

            }
        }
    }
}