let roomLayout = require('roomLayout');
let simpleRoom = require('room.simple');
let pathUtils = require('path.utils');

module.exports = {
    "run": basicManager
};

function basicManager(){
    takeVisibleInputs();
    removeStale();
    harvestSources();
    depositIncome();
    requestHarvesters();
}

function removeStale(){
    // TODO transition to second time based way.
    let spawnNames = Object.keys(Game.spawns);
    if (spawnNames.length === 0) { return }
    let firstSpawn = Game.spawns[spawnNames[0]];
    for (let sourceId in Memory.sources) {
        sourceMemory = Memory.sources[sourceId];
        if (firstSpawn.pos.roomName !== sourceMemory.pos.roomName) {
            delete Memory.sources[sourceId];
        }
    }

    for (let sourceId in Memory["sources"]){
        if (isStale(Memory.sources[sourceId])){
            //console.log(sourceId + " is stale - deleted");
            //delete Memory.sources[sourceId]
        }
    }
}
function isStale(source){
    return false;
    return source.lastUpdatedTime + SECONDS_TO_KEEP_SOURCES < Game.time;
}
function takeVisibleInputs(){

    let spawnNames = Object.keys(Game.spawns);
    if (spawnNames.length === 0) { return }
    let firstSpawn = Game.spawns[spawnNames[0]];

    for (let source of firstSpawn.room.find(FIND_SOURCES)) {
        if (Memory.sources[source.id] === undefined || 1) {

            let sourceDetail = sourceDetails(source, firstSpawn);
            console.log("Before storage: ", JSON.stringify(sourceDetail));
            Memory.sources[source.id] = sourceDetail;
        }
    }
}
function harvestSources(){
    for (let sourceId in Memory["sources"]){
        sourceRecord = Memory.sources[sourceId];
        harvestSource(sourceRecord);
    }
}
function harvestSource(sourceRecord){
    let creep = Game.creeps[sourceRecord.primaryWorker];
    if (!creep){return;}

    let source = Game.getObjectById(sourceRecord.id);
    if (creep.harvest(source) === ERR_NOT_IN_RANGE){
        if(creep.moveByPath(sourceRecord.pathFromSpawn) === ERR_NOT_FOUND){
            console.log(creep.name + " moving to beginning of source path");
            creep.moveTo(sourceRecord.pathFromSpawn[0].x, sourceRecord.pathFromSpawn[0].y);
        }
    }
}
function depositIncome() {
    for (let sourceId in Memory["sources"]) {
        sourceRecord = Memory.sources[sourceId];
        depositIncomeFrom(sourceRecord);
    }
}
function depositIncomeFrom(sourceRecord){
    let spawnNames = Object.keys(Game.spawns);
    if (spawnNames.length === 0) { return }
    let firstSpawn = Game.spawns[spawnNames[0]];
    let creep = Game.creeps[sourceRecord.primaryWorker];
    if (!creep){return;}

    if (creep.carry.energy > 44){
        creep.transfer(firstSpawn, RESOURCE_ENERGY);
    }
}
function requestHarvesters() {
    for (let sourceId in Memory["sources"]) {
        sourceRecord = Memory.sources[sourceId];
        requestHarvestersFor(sourceRecord);
    }
}
function requestHarvestersFor(sourceRecord){
    console.log("Checking if Source ",sourceRecord.id," in ", sourceRecord.pos.roomName, " needs a new worker")

    let spawnNames = Object.keys(Game.spawns);
    if (spawnNames.length === 0) { return }
    let firstSpawn = Game.spawns[spawnNames[0]];
    if (Game.creeps[sourceRecord.primaryWorker] === undefined){
        console.log("Source ",sourceRecord.id," in ", sourceRecord.pos.roomName, " is creating a new worker")
        sourceRecord.primaryWorker = firstSpawn.createCreep([WORK,WORK,MOVE,CARRY]);
    }
}


function sourceDetails(source, spawn){

    let layoutSource = roomLayout.getSourceRecord(source.pos);
    let closestSpawn = spawn;

    let pathFromSpawn = closestSpawn.pos.findPathTo(source);

    let reversePath = pathUtils.reversePath(layoutSource.pathToController);
    console.log("Path after reversal: ", JSON.stringify(reversePath));

    let sourceDetail =  {
        'pos': source.pos,
        'id': source.id,
        'energyCapacity': source.energyCapacity,
        'harvestSpot': layoutSource.harvestSpot,
        'energyPickupSpot': layoutSource.energyPickupSpot,
        'energyDropoffSpot': layoutSource.energyDropoffSpot,
        'controllerWorkSpot': layoutSource.upgradeSpot,
        'closestSpawn': closestSpawn.name,
        'pathFromSpawn': pathFromSpawn,
        'pathFromController': reversePath,
        'pathToController': layoutSource.pathToController,
        'distToSpawn': pathFromSpawn.length,
        'primaryWorker': '',
        'workers': []
    };
    console.log("sourceDetail: ", JSON.stringify(sourceDetail));

    return sourceDetail;
}