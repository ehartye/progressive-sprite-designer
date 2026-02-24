❯ I want to create a progressive sprite designer using google's nano banana.\                                                   
  here's my gemini api key: AIzaSyBYhUFoFuOS3u4SXBRCyQStfcTjmGrltEQ\                                                            
  \                                                                                                                             
  (there is no backslash at the end of my api key)                                                                              
  \                                                                                                                             
  curl snippet: \                                                                                                               
  curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent" \                             
    -H 'Content-Type: application/json' \                                                                                       
    -H 'X-goog-api-key: AIzaSyBYhUFoFuOS3u4SXBRCyQStfcTjmGrltEQ' \                                                              
    -X POST \                                                                                                                   
    -d '{                                                                                                                       
      "contents": [                                                                                                             
        {                                                                                                                       
          "parts": [                                                                                                            
            {                                                                                                                   
              "text": "Explain how AI works in a few words"                                                                     
            }                                                                                                                   
          ]                                                                                                                     
        }                                                                                                                       
      ]                                                                                                                         
    }'\                                                                                                                         
  here's a conv I had with you about sprite:\                                                                                   
  Yes — there are very well-established conventions, and they vary depending on whether you're making a top-down RPG (like      
  Final Fantasy VI), an action RPG (like Chrono Trigger/Secret of Mana), or a side-scrolling game. Here's the breakdown:        
                                                                                                                                
  ## Top-Down RPG Humanoid (FF6 / RPG Maker Style)                                                                              
                                                                                                                                
  This is the most standardized format in the SNES era. It's essentially what RPG Maker codified into a formal spec.            
                                                                                                                                
  ### Overworld / Map Sprites                                                                                                   
                                                                                                                                
  Final Fantasy VI uses a base sprite size of approximately 16×24 pixels. Character movement is strictly 4-directional, and     
  movement cycles have 4 frames.                                                                                                
                                                                                                                                
  The standard overworld character sheet layout:                                                                                
                                                                                                                                
  **4 Directions × 3 Frames = 12 sprites minimum**                                                                              
                                                                                                                                
  | | Frame 1 (Left Step) | Frame 2 (Idle/Stand) | Frame 3 (Right Step) |                                                       
  |---|---|---|---|                                                                                                             
  | **Row 1** | Walk Down 1 | Stand Down | Walk Down 2 |                                                                        
  | **Row 2** | Walk Left 1 | Stand Left | Walk Left 2 |                                                                        
  | **Row 3** | Walk Right 1 | Stand Right | Walk Right 2 |                                                                     
  | **Row 4** | Walk Up 1 | Stand Up | Walk Up 2 |                                                                              
                                                                                                                                
  The classic RPG walk cycle is a "three" frame step-idle-step cycle. It's the one used in old Final Fantasy games and the RPG  
  Maker RTP graphics. The cycle actually uses four frames — the idle one repeats. It goes step-idle-step-idle.                  
                                                                                                                                
  Walking/stepping animations cycle: Middle → Right → Middle → Left → Middle. The Middle sprite is used for the event standing  
  still.                                                                                                                        
                                                                                                                                
  This is also exactly what RPG Maker formalized: A map sprite is always 3×4 cells — 3 frame animation on 4 directions. By      
  default this is used for walking.                                                                                             
                                                                                                                                
  Beyond the basic walk, SNES RPGs typically added these **additional overworld poses** (not always animated, sometimes single  
  frames):                                                                                                                      
                                                                                                                                
  - Surprise/shock (arms raised)                                                                                                
  - Nodding                                                                                                                     
  - Head shake                                                                                                                  
  - Laughing                                                                                                                    
  - Sad/depressed (head down)                                                                                                   
  - Sitting                                                                                                                     
  - Sleeping/KO                                                                                                                 
  - Waving                                                                                                                      
  - Jumping (used for ledge-hopping in FF6)                                                                                     
                                                                                                                                
  ### Battle Sprites (Side-View)                                                                                                
                                                                                                                                
  This is a separate, larger sprite set. RPG Maker codified the SNES-era battle standard: a battler sheet has six rows with     
  three different battle poses of three frame animation each (total 9×6 cells), used only in side-view battles.                 
                                                                                                                                
  The standard SNES side-view battle poses for a humanoid:                                                                      
                                                                                                                                
  1. **Idle/Ready** — battle stance (3 frames, subtle breathing/bounce)                                                         
  2. **Walk/Advance** — stepping forward to attack (3 frames)                                                                   
  3. **Physical Attack** — weapon swing (3 frames)                                                                              
  4. **Magic Cast** — arms raised, channeling (3 frames)                                                                        
  5. **Damage/Hit** — recoiling from being struck (3 frames)                                                                    
  6. **Victory** — celebration pose (3 frames)                                                                                  
  7. **Weak/Critical** — kneeling, low HP (1-3 frames)                                                                          
  8. **KO/Dead** — fallen on ground (1-2 frames)                                                                                
  9. **Defend/Guard** — blocking stance (1-3 frames)                                                                            
                                                                                                                                
  FF6 specifically also included: evade/dodge, item use, unique character skill poses (Sabin's Blitz input pose, Cyan's         
  charging pose, etc.), and status effect variations.                                                                           
                                                                                                                                
  ### RPG Maker 2003 Battle Standard                                                                                            
                                                                                                                                
  The older RPG Maker 2003 used a more explicit layout at 48×48 per frame: Battlechar sheets are 144×384, meaning 8 "stances"   
  of 3 frames each, so 48×48 per frame.                                                                                         
                                                                                                                                
  The 8 standard stances: Idle, Walk Forward, Attack, Cast/Skill, Damage, Dead, Item Use, Victory.                              
                                                                                                                                
  ## Action RPG Humanoid (Chrono Trigger / Secret of Mana Style)                                                                
                                                                                                                                
  Chrono Trigger's main character has a 15×36px idle sprite. The bigger sprite size allows for more expressive and              
  differentiated actions such as running, emoting, and using weapons and techniques, especially during combat. Because battles  
  happen on the map itself (no separate battle screen), the sprite set is much larger.                                          
                                                                                                                                
  A typical Chrono Trigger-style character needs:                                                                               
                                                                                                                                
  **Movement** (4 or 8 directions × 4-6 frames each):                                                                           
  - Stand/Idle (4 directions)                                                                                                   
  - Walk (4 directions × 4 frames)                                                                                              
  - Run (4 directions × 4-6 frames)                                                                                             
                                                                                                                                
  **Combat** (often 4 directions or just left/right):                                                                           
  - Attack swing (3-6 frames)                                                                                                   
  - Casting/tech charge (3-4 frames)                                                                                            
  - Tech execution (varies per character/ability)                                                                               
  - Hit/damage recoil (2-3 frames)                                                                                              
  - Critical/weak stance (1-2 frames)                                                                                           
  - KO/fallen (1-2 frames)                                                                                                      
                                                                                                                                
  **Emote/Cutscene:**                                                                                                           
  - Surprise                                                                                                                    
  - Laugh                                                                                                                       
  - Nod                                                                                                                         
  - Look around                                                                                                                 
  - Sit                                                                                                                         
  - Sleep                                                                                                                       
                                                                                                                                
  Chrono Trigger's party sprites alone total 590 sprites, giving you a sense of how much more extensive the action RPG set is   
  compared to a turn-based game.                                                                                                
                                                                                                                                
  ## Side-Scrolling / Platformer Humanoid                                                                                       
                                                                                                                                
  For games like Mega Man X, Castlevania, etc.:                                                                                 
                                                                                                                                
  - Idle (2-4 frames, subtle breathing)                                                                                         
  - Run (6-8 frames)                                                                                                            
  - Jump rising (1-2 frames)                                                                                                    
  - Jump falling (1-2 frames)                                                                                                   
  - Land (1-2 frames)                                                                                                           
  - Attack (standing, 3-4 frames)                                                                                               
  - Attack (crouching, 3-4 frames)                                                                                              
  - Attack (aerial, 2-3 frames)                                                                                                 
  - Crouch/duck (1-2 frames)                                                                                                    
  - Climb/ladder (2-4 frames)                                                                                                   
  - Slide/dash (2-3 frames)                                                                                                     
  - Damage/hit (2-3 frames)                                                                                                     
  - Death (3-5 frames)                                                                                                          
  - Wall slide (Mega Man X style, 1-2 frames)                                                                                   
                                                                                                                                
  SMB1, SMB3, and SMW have a three-frame run for each form of Mario. SMB1 and SMB3 have one frame for jump; SMW has one for     
  rising and one for falling. So even the classics were minimal — you don't need as many frames as you'd think.                 
                                                                                                                                
  ## Creatures / Enemies                                                                                                        
                                                                                                                                
  SNES creature sprites follow looser conventions, but the common patterns are:                                                 
                                                                                                                                
  **For static turn-based enemies (FF6 style):**                                                                                
  - Single front-facing illustration (no animation — Chrono Trigger's use of animated monster sprites consumed much more memory 
   than previous Final Fantasy games, which used static enemy graphics)                                                         
  - This is literally just one sprite per enemy in many SNES RPGs                                                               
                                                                                                                                
  **For animated enemies (Chrono Trigger style):**                                                                              
  - Idle/breathing (2-4 frames)                                                                                                 
  - Attack (3-6 frames, varies wildly by creature type)                                                                         
  - Damage taken (1-3 frames)                                                                                                   
  - Death/dissolve (3-6 frames)                                                                                                 
  - Special ability (varies)                                                                                                    
                                                                                                                                
  **For overworld creatures (Secret of Mana, Zelda-likes):**                                                                    
  - Walk in 4 directions (3-4 frames each)                                                                                      
  - Attack in 4 directions (2-4 frames each)                                                                                    
  - Damage (1-2 frames)                                                                                                         
  - Death (2-4 frames)                                                                                                          
  - Idle (1-2 frames)                                                                                                           
                                                                                                                                
  ## Practical Minimum Set for AI Generation                                                                                    
                                                                                                                                
  If you're generating with Gemini/AI and want a viable SNES-style character, here's what I'd prioritize:                       
                                                                                                                                
  **Minimum viable top-down RPG character (36 sprites):**                                                                       
  - 4 directions × 3 walk frames = 12                                                                                           
  - 4 directions × 1 idle = 4 (often same as walk middle frame)                                                                 
  - Battle: idle, attack, cast, damage, KO, victory × 3 frames each = 18                                                        
  - Weak/critical pose = 2                                                                                                      
                                                                                                                                
  **Minimum viable action RPG character (~48-64 sprites):**                                                                     
  - 4 directions × 4 walk frames = 16                                                                                           
  - 4 directions × 1 idle = 4                                                                                                   
  - 4 directions × 3 attack frames = 12                                                                                         
  - Cast/charge × 3 frames = 3-12                                                                                               
  - Damage, KO, emotes = 8-16                                                                                                   
                                                                                                                                
  **Minimum viable creature/enemy (~12-24 sprites):**                                                                           
  - Idle (2-4 frames)                                                                                                           
  - Attack (3-6 frames)                                                                                                         
  - Damage (2-3 frames)                                                                                                         
  - Death (3-5 frames)                                                                                                          
  - Movement if overworld (4 directions × 3 frames)                                                                             
                                                                                                                                
  The Spriters Resource at spriters-resource.com/snes/ is the best reference for seeing exactly how real SNES games organized   
  their sheets — you can look at the ripped sprites from FF6, Chrono Trigger, Secret of Mana, etc. to see the exact layouts and 
   frame counts the professionals used.\                                                                                        
  \                                                                                                                             
  each of the collections of poses are kind of hierarchical you start with one and base the others on it.\                      
  so for a given character I want to start by generating one of those, getting some options, selecting the one I like, then     
  building on it by generating the next pose. after the initial, every prompt for the next image should be sent in with the     
  preceding approved images. \                                                                                                  
  every prompt should have a super prompt describing what we're going for, style guidance, character description, then every    
  pose should have its own specific prompt. at each step of the way I want the ability to regenerate my results, select new     
  approved results, etc. then end result should be a fully fleshed out animated character or at least the raw materials to make 
   it. I realize there will be a bunch of post processing steps besides image gen to make this a reality, but for this first    
  draft I want to start with just the image iteration.                                                                          
