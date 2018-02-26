
module.exports = {
    getSources: getSimpleSources,
    getController: getSimpleController,
    getMineral: getSimpleMineral
};

function getSimpleSources(roomName){
    let simpleRoom = getSimpleRoom(roomName);
    return simpleRoom && simpleRoom["sources"] ? simpleRoom["sources"]: undefined;
}
function getSimpleController(roomName){
    let simpleRoom = getSimpleRoom(roomName);
    return simpleRoom && simpleRoom["controller"] ? simpleRoom["controller"]: undefined;
}
function getSimpleMineral(roomName){
    let simpleRoom = getSimpleRoom(roomName);
    return simpleRoom && simpleRoom["mineral"] ? simpleRoom["mineral"]: undefined;
}

function getSimpleRoom(roomName){
    if (!Memory["simpleRooms"]){Memory.simpleRooms = {};}
    return Memory.simpleRooms[roomName] ? Memory.simpleRooms[roomName] : createMissingRoom(roomName);
}
function createMissingRoom(roomName) {
    if (!roomName || !Game.rooms[roomName]) {
        return undefined;
    }
    console.log("initializing ", roomName);

    let room = Game.rooms[roomName];
    Memory.simpleRooms[roomName] = {};
    if (room.controller) {
        Memory.simpleRooms[roomName].controller = {
            "id": room.controller.id,
            "pos": room.controller.pos
        };
    }
    let sources = room.find(FIND_SOURCES);
    if(sources.length){
        Memory.simpleRooms[roomName].sources = {};
        for (let source of sources){
            Memory.simpleRooms[roomName].sources[source.id] = {
                "id": source.id,
                "pos": source.pos
            };
        }
    }
    let minerals = room.find(FIND_MINERALS);
    if(minerals.length){
        //only ever one max
        let mineral = minerals[0];
        Memory.simpleRooms[roomName].mineral = {
            "id": mineral.id,
            "pos": mineral.pos,
            "mineralType": mineral.mineralType
        }
    }
    let lairs = room.find(FIND_HOSTILE_STRUCTURES,{"filter": STRUCTURE_KEEPER_LAIR});
    if (lairs.length){
        for (let lair of lairs){
            Memory.simpleRooms[roomName].lairs[lair.id] = {
                "id": lair.id,
                "pos": lair.pos
            };
        }

    }
        return undefined;
}