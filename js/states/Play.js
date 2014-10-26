/* global SB2 */
/* global Phaser */
"use strict";

/** Game state for the game's core */
SB2.Play = function (game) {
    // Call State constructor on this instance and add this state to game engine, without starting it
    Phaser.State.call(this, game);
    game.state.add("Play", this, false);
};

// Extends Phaser.State
SB2.Play.prototype = Object.create(Phaser.State.prototype);
SB2.Play.prototype.constructor = SB2.Play;

//------------------------------------------------------------------------------
// Members
//------------------------------------------------------------------------------
/** Controls of player 1 and 2 */
SB2.Play.controls1;
SB2.Play.controls2;
/** References to the cubes objects */
SB2.Play.cube1;
SB2.Play.cube2;
/** This group contains all the solid and fixed platforms */
SB2.Play.platforms;
SB2.Play.screenLimit; /** Used to check when cubes hit the screen borders */
SB2.Play.swap; /** Timer for controls swap */
SB2.Play.swapIndicators; /** The group of HUD indicators for swap */
SB2.Play.swapTween; /** Tween used to make the indicators flash */

//------------------------------------------------------------------------------
// Game state
//------------------------------------------------------------------------------
SB2.Play.prototype.PAUSED = 0;
SB2.Play.prototype.RUNNING = 1;

//------------------------------------------------------------------------------
// State functions
//------------------------------------------------------------------------------
SB2.Play.prototype.preload = function () {};

SB2.Play.prototype.create = function () {    
    /* We will define below, everything that should be started and instanciated
    * in order to make the addition of biome's contexts possible */

    //  We're going to be using physics, so enable the Arcade Physics system
    this.game.physics.startSystem(Phaser.Physics.ARCADE);

    /* Adjust the size of the world. This will implicitly impacts the maximum 
    size of each biome */
    this.game.world.setBounds(0, 0, SB2.WIDTH*10, SB2.HEIGHT);

    /* Preparing the biome generation by creating a level's seed and
        instanciating a pseudo-random generator using a specific string
        that could be for example, the name of the level.
    */
    this.seed = SB2.Randomizer.prototype.genSeedFromPhrase("Greta Svabo Bech");
    this.randomizer = new SB2.Randomizer(this.seed);

    // Initialize the screen limit
    this.initBackground();
    this.initScreenLimit();

    // Initialize the cameraman, the background and the swap indicators
    this.cameraman = new SB2.Cameraman(this.game.camera, this.game.time);

    // Preparing controls and cubes; btw, cube's position will be set by the biome
    this.initControls();
    this.cube1 = new SB2.Cube(this.game, 0, 500, this.controls1, 0);
    this.cube2 = new SB2.Cube(this.game, 0, 500, this.controls2, 1);

    // Init music
    this.initMusic();
    this.initSwap();

    // Add events when paused
    this.game.onPause.add(this.onPaused, this);
    this.game.onResume.add(this.onResumed, this);

    // Start the biome Sequencer
    this.sequencer = new SB2.BiomesSequencer(
        new SB2.Randomizer(this.randomizer.genSeed()), 
        this.cube1, this.cube2, 
        this.screenLimit, this.game);

    this.text = this.game.add.text(0, 0, "");

    // Finally, set up the correct state
    this.state = this.RUNNING;
};

SB2.Play.prototype.update = function () {
    // According to game state
    switch(this.state) {
    case this.DYING:
        this.updateDying();
        break;   
    case this.RUNNING:
        this.updateRunning();
        break;
    }
};

/** Update function that pause the game */
SB2.Play.prototype.updateDying = function () {
    if(this.cube1.state == SB2.Cube.prototype.DEAD ||
       this.cube2.state == SB2.Cube.prototype.DEAD) {
        //this.game.state.start('Play');
    } else {
        this.cube1.myUpdate();
        this.cube2.myUpdate();
    }
};

SB2.Play.prototype.updateRunning = function () {
    var i, endOfLastBiome;

    // Control swap
    this.handleSwap();
    
    //Update all biomes
    this.sequencer.updateBiomes();
    
    // Tell the cameraman to follow players positions
    this.cameraman.update(this.cube1, this.cube2, this.cities);

    // Update cubes states
    this.cube1.myUpdate();
    this.cube2.myUpdate();
    
    //  Checks to see if the both cubes overlap
    // if(this.game.physics.arcade.overlap(this.cube1, this.screenLimit)){
    //     console.log(JSON.stringify(this.trigger.position));
    // }

    // if(this.game.physics.arcade.overlap(this.cube1, this.cube2)
    //    || !this.game.physics.arcade.overlap(this.cube1, this.screenLimit)
    //    || !this.game.physics.arcade.overlap(this.cube2, this.screenLimit)) {
    //       this.deathTouch();
    //   }
};

SB2.Play.prototype.render = function () {
    this.game.debug.cameraInfo(this.game.camera, 25, 32);    
    this.game.debug.bodyInfo(this.cube1, 500, 32);    
};

//------------------------------------------------------------------------------
// Other functions
//------------------------------------------------------------------------------
/** Measure time and swap controls if needed. Also in charge to
 * display timing indicators */
SB2.Play.prototype.handleSwap = function () {
    // Check the timer 
    if(this.swap.timer.elapsed() > SB2.INDIC_PERIOD*this.swap.count) {
        // If it's the last indicator
        if(this.swap.count%SB2.NUM_INDIC == 2) {
            // Make a swap
            SB2.Cube.swap(this.cube1, this.cube2);
            // Make a primary flash
            this.swapIndicators.alpha = 1.0;
            this.swapTween.primary.start();
        } else {
            if(SB2.SECONDARY_INDICATOR) {
                // Make a secondary flash
                this.swapIndicators.alpha = 0.1;
                this.swapTween.secondary.start();
            }
        }

        // update the swap
        this.swap.count++;
    }
};

/** Called when the two players collide */
SB2.Play.prototype.deathTouch = function () {
    this.cube1.die();
    this.cube2.die();
    // Update game state
    this.state = this.DYING;
};


SB2.Play.prototype.onPaused = function () {
    this.swap.timer.pause();
    this.music.pause();
};

SB2.Play.prototype.onResumed = function () {
    this.swap.timer.resume();
    this.music.resume();
};

//------------------------------------------------------------------------------
// Initialization functions
//------------------------------------------------------------------------------

/** Initialize the backgrounds of the game area */
SB2.Play.prototype.initBackground = function() {
    var city, cityNames, i; // Used for temporary setting

    // Set the background color
    this.game.stage.backgroundColor = SB2.BACKGROUND_COLOR;

    // Add two cities in the background giving a parallax effect
    this.cities = [];
    cityNames = ['city1', 'city2'];
    for ( i = 0; i < cityNames.length; i++) {
        city = this.game.add.tileSprite(0, 0, 800, 600, cityNames[i]);
        city.fixedToCamera = true;
        this.cities.push(city);
    }
};

/** This function initialize the level. (Generate the first platforms) */
SB2.Play.prototype.initLevel = function () {
    // For platform creation
    var ground;

    this.platforms = this.game.add.group(undefined, // Parent group
                                         'platforms', // Name for debug
                                         false, // Add directly to the stage
                                         true, // Enable body
                                         Phaser.Physics.ARCADE);

    // Here we create the ground.
    ground = this.platforms.create(0, SB2.HEIGHT - 2*SB2.UNIT, 'plain');
    //  Scale it to fit the width of the game
    ground.scale.setTo(SB2.WIDTH*10, 2*SB2.UNIT);
    //  This stops it from falling away when you jump on it
    ground.body.immovable = true;

    ground = this.platforms.create(0, SB2.HEIGHT - 4*SB2.UNIT, 'plain');
    //  Scale it to fit the width of the game
    ground.scale.setTo(SB2.WIDTH/3, 2*SB2.UNIT);
    //  This stops it from falling away when you jump on it
    ground.body.immovable = true;

    ground = this.platforms.create(SB2.WIDTH/2, SB2.HEIGHT - 7*SB2.UNIT, 'plain');
    //  Scale it to fit the width of the game
    ground.scale.setTo(SB2.WIDTH/2, 2*SB2.UNIT);
    //  This stops it from falling away when you jump on it
    ground.body.immovable = true;
};

/** Initialize the controls for player 1 and 2 */
SB2.Play.prototype.initControls = function () {
    var kb = this.game.input.keyboard;
    this.controls1 = new SB2.Controls(kb.addKey(Phaser.Keyboard.UP),
                           null,
                           kb.addKey(Phaser.Keyboard.RIGHT),
                           kb.addKey(Phaser.Keyboard.LEFT));
    this.controls2 = new SB2.Controls(kb.addKey(Phaser.Keyboard.FIVE),
                           null,
                           kb.addKey(Phaser.Keyboard.Y),
                           kb.addKey(Phaser.Keyboard.R));
};

/** Initialize the swap indicators and begin the swap timer. */
SB2.Play.prototype.initSwap = function () {
    var indic,  // Temporary variable to create swap indicators
    // constants shorthands
    H = SB2.HEIGHT, W = SB2.WIDTH,
    ITH = SB2.INDIC_THICK, U = SB2.UNIT,
    P = SB2.INDIC_PERIOD;


    this.swapIndicators = this.game.add.group(undefined, 'indicators', true,  false); // No body
    this.swapIndicators.alpha = 0;

    // Create 4 bars assembling into a frame
    // TOP
    indic = this.swapIndicators.create(0, 0, 'plain');
    indic.scale.setTo(W, ITH);
    // BOTTOM
    indic = this.swapIndicators.create(0, H - ITH, 'plain');
    indic.scale.setTo(W, ITH);
    // LEFT
    indic = this.swapIndicators.create(W - ITH, ITH, 'plain');
    indic.scale.setTo(ITH, H - 2*ITH);
    // RIGHT 
    indic = this.swapIndicators.create(0, ITH, 'plain');
    indic.scale.setTo(ITH, H - 2*ITH);

    // Init the indicator tweener
    this.swapTween = {primary: this.game.add.tween(this.swapIndicators),
                      secondary: this.game.add.tween(this.swapIndicators)};
    this.swapTween.primary.from({alpha:0}, P/2);
    this.swapTween.secondary.from({alpha:0}, P/4);

    // Init swap timer
    this.swap = {timer: new SB2.Timer(this.game),
                 count:0};
    this.swap.timer.start();
    this.music.play("", 0, 1, true);
    this.music.loop = true;
};

/** Initialize the controls for player 1 and 2 */
SB2.Play.prototype.initControls = function () {
    var kb = this.game.input.keyboard;
    this.controls1 = new SB2.Controls(kb.addKey(Phaser.Keyboard.UP),
                                      null,
                                      kb.addKey(Phaser.Keyboard.RIGHT),
                                      kb.addKey(Phaser.Keyboard.LEFT));
    this.controls2 = new SB2.Controls(kb.addKey(Phaser.Keyboard.FIVE),
                                      null,
                                      kb.addKey(Phaser.Keyboard.Y),
                                      kb.addKey(Phaser.Keyboard.R));
};

/** Initialize the screen limit used to check when cube exit the screen */
SB2.Play.prototype.initScreenLimit = function () {
    // An invisible rectangle that cover almost the entire screen,
    // used for collision
    var trigger = this.game.add.sprite(SB2.UNIT, SB2.UNIT, null, 0, this.screenLimit);
    this.game.physics.arcade.enable(trigger);
    trigger.body.setSize(SB2.WIDTH - 2*SB2.UNIT, SB2.HEIGHT - 2*SB2.UNIT);
    trigger.fixedToCamera = true;
    this.screenLimit = trigger;
};

SB2.Play.prototype.initMusic = function () {
    function muteFunction () {
        if(this.game.sound.mute) {
            // Demute
            // Update button icon
            this.muteButton.frame = 0;
            this.game.sound.mute = false;
            SB2.muted = false;
        } else {
            // Mute
            this.muteButton.frame = 1;        
            this.game.sound.mute = true;
            SB2.muted = true;
        }
    }

    // Init music
    this.music = this.game.add.audio('music');

    // Init mute button
    this.muteButton = this.game.add.button(0, 0, 'mute', muteFunction, this);
    this.muteButton.frame = SB2.muted ? 1 : 0;
    this.muteButton.alpha = 0.5;
    this.muteButton.fixedToCamera = true;
};
