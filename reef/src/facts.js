// Spoken narration facts for the Indian Reef explorer.
// Written for a curious child of about eight, to be read aloud by a narrator voice.
//
// Fields:
//   name   display name
//   sci    scientific name
//   group  one of: 'plant' | 'coral' | 'invertebrate' | 'fish' | 'reptile' | 'mammal'
//   size   spoken size, metric, no digits
//   where  short lower case phrase saying where the child will find it
//   hook   three to seven word caption
//   fact   two to four sentences, spoken aloud
//   night  optional, what it does after dark

export const FACTS = {
  seagrass: {
    name: 'Seagrass',
    sci: 'Thalassia hemprichii',
    group: 'plant',
    size: 'leaves up to about thirty centimetres long',
    where: 'the sandy shallows of the lagoon',
    hook: 'A flower that blooms under the sea',
    fact: 'Seagrass is not a seaweed. It is a true flowering plant, with roots, leaves, and tiny flowers, like a garden grass that moved into the sea. Its roots hold the sand in place, and whole meadows of it feed green turtles and dugongs. Many baby fish hide among its blades until they are big enough for the reef.',
  },

  halimeda: {
    name: 'Halimeda',
    sci: 'Halimeda',
    group: 'plant',
    size: 'about ten centimetres tall',
    where: 'sandy patches between the corals',
    hook: 'The seaweed that turns into sand',
    fact: 'Much of the white sand on a tropical beach was once this green seaweed. Halimeda builds tiny plates of limestone inside each of its segments. When the plant dies, the segments break apart and bleach white, and the waves grind them into sand. Pick up a handful of beach sand and you may be holding old Halimeda.',
  },

  coralline: {
    name: 'Coralline algae',
    sci: 'Corallinales',
    group: 'plant',
    size: 'a crust only a few millimetres thick',
    where: 'the pink crust on rocks and dead coral',
    hook: 'The pink cement of the reef',
    fact: 'This pink crust is alive, a kind of algae that holds the reef together. Coralline algae grow a hard skeleton of limestone and spread over loose rubble, gluing the pieces together like cement. Where the waves pound the reef edge, it forms the toughest part of all. Baby corals love to settle on it.',
  },

  staghorn: {
    name: 'Staghorn coral',
    sci: 'Acropora',
    group: 'coral',
    size: 'thickets often a metre or more across',
    where: 'thickets on the shallow reef flat',
    hook: 'An animal shaped like antlers',
    fact: 'A staghorn coral is not a rock and not a plant. It is a colony of thousands of tiny animals called polyps, each one building a little cup of limestone to live in. Together they grow branches like the antlers of a deer, and they are among the fastest growing corals, adding about ten centimetres in a year.',
    night: 'After dark, every polyp on the branches pushes out a ring of tiny tentacles and the whole coral turns fuzzy. The tentacles catch plankton drifting past in the current. By day they pull back in and the coral looks hard and bare again.',
  },

  tableCoral: {
    name: 'Table coral',
    sci: 'Acropora hyacinthus',
    group: 'coral',
    size: 'plates often about a metre across',
    where: 'the flat plates on the reef slope',
    hook: 'A tabletop built by tiny animals',
    fact: 'A table coral grows into a flat plate that can be wider than you are tall. It is one animal colony made of thousands of tiny polyps, and all that limestone is built by them. The shade under the table is a favourite hiding place for small fish, which dart out to feed and back again.',
    night: 'At night the top of the table comes alive. Thousands of polyps stretch out their tentacles at once to grab tiny animals floating by. On a few special nights each year, corals like this release clouds of eggs into the water all together.',
  },

  brainCoral: {
    name: 'Brain coral',
    sci: 'Platygyra',
    group: 'coral',
    size: 'boulders often half a metre across',
    where: 'a rounded boulder on the reef slope',
    hook: 'Older than your great grandparents',
    fact: 'A brain coral can be older than your great grandparents. It grows very slowly, around a centimetre a year, so a boulder as wide as a table may have been growing for a hundred years or more. The winding grooves on its surface are valleys where rows of tiny polyps live side by side, sharing one skin.',
    night: 'By day the brain coral looks smooth and bare. After dark, tiny tentacles rise along every groove until the whole boulder looks furry. They catch plankton drifting in the current, and then they pull back in before the sun comes up.',
  },

  mushroomCoral: {
    name: 'Mushroom coral',
    sci: 'Fungia',
    group: 'coral',
    size: 'about fifteen centimetres across',
    where: 'lying loose on the sand at the reef base',
    hook: 'The coral that is one animal',
    fact: 'Most corals are colonies of thousands of tiny animals fixed to the reef. The mushroom coral is one single animal, and it is not attached to anything. It lies loose on the sand, and it can slowly move by puffing up with water, and even turn itself the right way up if a wave flips it over.',
  },

  fireCoral: {
    name: 'Fire coral',
    sci: 'Millepora',
    group: 'coral',
    size: 'blades about thirty centimetres tall',
    where: 'the reef crest where the waves break',
    hook: 'Looks like coral, stings like jellyfish',
    fact: 'Fire coral is not a true coral at all. It is a closer cousin of jellyfish, and like them it stings. Its mustard yellow surface is covered in hairs too small to see, and a brush against it leaves a burning rash that can last for days. Divers learn to look for its white tips and keep their hands away.',
  },

  seaFan: {
    name: 'Sea fan',
    sci: 'Gorgonacea',
    group: 'coral',
    size: 'often half a metre to a metre across',
    where: 'the deep reef wall where the current flows',
    hook: 'A fan that faces the current',
    fact: 'A sea fan grows across the current on purpose. It is a soft coral colony that spreads into a flat fan turned to face the current, so that thousands of tiny polyps can catch plankton as the water flows through. Its skeleton is bendy, not stony, so the whole fan sways back and forth without breaking.',
  },

  leatherCoral: {
    name: 'Leather coral',
    sci: 'Sarcophyton',
    group: 'coral',
    size: 'about thirty centimetres across',
    where: 'a soft mushroom shape on the reef flat',
    hook: 'The coral with no stony skeleton',
    fact: 'A leather coral has no stony skeleton. It feels soft and rubbery, a bit like a wet leather glove. When its polyps are out it looks fuzzy and alive, and when they pull in it looks like a smooth yellow mushroom. Every so often it sheds a thin waxy skin to clean itself of algae and dirt.',
  },

  anemone: {
    name: 'Magnificent sea anemone',
    sci: 'Heteractis magnifica',
    group: 'invertebrate',
    size: 'often half a metre across',
    where: 'on the reef wall with clownfish inside',
    hook: 'A stinging flower that is an animal',
    fact: 'A sea anemone looks like a flower, but it is an animal, a cousin of corals and jellyfish. Every tentacle is loaded with tiny stinging darts that fire when a fish brushes past. Clownfish are a famous exception, and they live right inside it. This anemone can grow to about a metre across and may live for decades.',
  },

  barrelSponge: {
    name: 'Barrel sponge',
    sci: 'Xestospongia testudinaria',
    group: 'invertebrate',
    size: 'up to about a metre tall',
    where: 'a big open barrel on the reef slope',
    hook: 'No mouth, no brain, still alive',
    fact: 'A barrel sponge is an animal with no mouth, no brain, and no stomach. It feeds by pumping seawater through thousands of tiny holes in its sides, sifting out specks of food, and pushing the clean water out of the big opening on top. It grows slowly, and a big one may have been growing for a hundred years or more.',
  },

  giantClam: {
    name: 'Giant clam',
    sci: 'Tridacna maxima',
    group: 'invertebrate',
    size: 'about thirty centimetres long',
    where: 'wedged into the coral with its frills showing',
    hook: 'A clam that farms sunlight',
    fact: 'A giant clam farms its own food. The bright blue and green frills you see are its mantle, and it is packed with tiny algae that make sugar from sunlight and share it with the clam. That is why it sits with its shell open, soaking up the sun. It has hundreds of tiny eyes along its frills, and when a shadow passes it pulls its mantle in and starts to close.',
  },

  christmasTreeWorm: {
    name: 'Christmas tree worm',
    sci: 'Spirobranchus giganteus',
    group: 'invertebrate',
    size: 'crowns about three centimetres tall',
    where: 'tiny spirals on the brain coral',
    hook: 'Tiny spirals that vanish in a blink',
    fact: 'Those tiny coloured spirals are the breathing gills of a worm, and they can vanish in a blink. The worm lives in a tube inside living coral, and only its two spiral crowns poke out to catch food and breathe. Pass a shadow over it and the crowns snap into the tube and a tiny trapdoor shuts.',
  },

  clownfish: {
    name: 'Clownfish',
    sci: 'Amphiprion clarkii',
    group: 'fish',
    size: 'about twelve centimetres long',
    where: 'inside a sea anemone on the reef wall',
    hook: 'The fish an anemone cannot sting',
    fact: 'A clownfish lives inside a sea anemone whose tentacles sting almost everything else. A special slimy coat on its skin stops the anemone from firing its stings. Every clownfish starts life as a male, and the biggest fish in the anemone turns into the female. It chases off butterflyfish that would nibble its anemone home.',
    night: 'When darkness comes, the clownfish sinks deep into the anemone and rests between the tentacles. The stinging arms close around it like a blanket, keeping it safe from hunting eels and other night prowlers while it sleeps.',
  },

  parrotfish: {
    name: 'Parrotfish',
    sci: 'Scarus ghobban',
    group: 'fish',
    size: 'about fifty centimetres long',
    where: 'crunching at the coral on the reef flat',
    hook: 'The fish that makes white sand',
    fact: 'Some of the white sand on the beach was made by this fish. A parrotfish has teeth fused into a hard beak, and all day it scrapes algae off the coral, crunching up bits of rock as it goes. The rock is ground to powder in its throat and comes out the other end as fine white sand.',
    night: 'At night a parrotfish tucks itself into a crevice and blows a see-through bubble of slime around its whole body, like a sleeping bag. Scientists think the cocoon hides its scent from hunting eels and keeps blood-sucking pests off its skin.',
  },

  butterflyfish: {
    name: 'Butterflyfish',
    sci: 'Chaetodon auriga',
    group: 'fish',
    size: 'about twenty centimetres long',
    where: 'picking at the coral, usually in a pair',
    hook: 'The fish with a fake eye',
    fact: 'This butterflyfish wears a fake eye. A dark spot near its tail looks like an eye, while a black stripe hides its real eye, so a hunter may lunge at the wrong end and the fish darts away the other way. It uses its pointed snout like tweezers to pick tiny worms and coral polyps out of cracks.',
  },

  moorishIdol: {
    name: 'Moorish idol',
    sci: 'Zanclus cornutus',
    group: 'fish',
    size: 'about twenty centimetres long',
    where: 'gliding over the coral, often in pairs',
    hook: 'Alone in its own fish family',
    fact: 'The Moorish idol trails a long white streamer from its back fin, sometimes longer than its whole body. It is the one and only member of its fish family, with surgeonfish as its nearest cousins. Its babies drift in the open ocean for a long time, growing surprisingly big before they ever settle on a reef and put on their stripes.',
  },

  emperorAngelfish: {
    name: 'Emperor angelfish',
    sci: 'Pomacanthus imperator',
    group: 'fish',
    size: 'about forty centimetres long',
    where: 'under a ledge on the reef wall',
    hook: 'Changes its whole outfit growing up',
    fact: 'A young emperor angelfish looks so different from its parents that people once thought they were two different fish. The baby is dark blue with swirling white rings. As it grows, the rings melt away and bold yellow and blue stripes appear, with a black mask across the eyes. It eats sponges that most other fish will not touch.',
  },

  powderBlueTang: {
    name: 'Powder-blue tang',
    sci: 'Acanthurus leucosternon',
    group: 'fish',
    size: 'about twenty centimetres long',
    where: 'grazing algae on the reef flat',
    hook: 'Hidden blades in its tail',
    fact: 'This gentle looking fish carries a hidden blade. Surgeonfish like the powder blue tang have a sharp spine on each side of the tail, folded flat like a pocket knife, and they can flick it out if a bully comes too close. The rest of the time it grazes on algae, sometimes in big blue crowds across the reef.',
    night: 'At dusk the tang wedges itself into a crack in the coral where it is hard to reach. Its bright blue goes dull and patchy while it sleeps, and the colour floods back at sunrise when it slips out to graze.',
  },

  picassoTriggerfish: {
    name: 'Picasso triggerfish',
    sci: 'Rhinecanthus aculeatus',
    group: 'fish',
    size: 'about twenty-five centimetres long',
    where: 'over the sand in the shallow lagoon',
    hook: 'Locks itself into a hole',
    fact: 'When a Picasso triggerfish is scared, it dives into a hole and locks itself in. A stiff spine on its back snaps upright and a second little spine wedges it in place like a trigger, so it is very hard to pull out. It swims by rippling its top and bottom fins, and it can grunt when annoyed.',
  },

  cleanerWrasse: {
    name: 'Cleaner wrasse',
    sci: 'Labroides dimidiatus',
    group: 'fish',
    size: 'about ten centimetres long',
    where: 'at a cleaning station on a coral head',
    hook: 'The tiny dentist of the reef',
    fact: 'Big fish line up and wait their turn for this little fish. The cleaner wrasse runs a cleaning station on the reef, and customers hover with their mouths and gill covers wide open while it nips off parasites and dead skin. Even hunters like groupers and morays let it swim right inside their mouths and do not bite.',
  },

  sergeantMajor: {
    name: 'Sergeant major',
    sci: 'Abudefduf vaigiensis',
    group: 'fish',
    size: 'about fifteen centimetres long',
    where: 'in a shimmering crowd above the reef',
    hook: 'The father who guards the eggs',
    fact: 'When sergeant majors breed, it is the father who guards the eggs, and he turns dark blue while on duty. He fans a patch of purple eggs stuck to the rock and chases off anything that comes near. The stripes on its sides, like the stripes on an army sleeve, give the fish its name.',
  },

  lionfish: {
    name: 'Lionfish',
    sci: 'Pterois miles',
    group: 'fish',
    size: 'about thirty centimetres long',
    where: 'hanging under a ledge, fins spread',
    hook: 'Beautiful fins, venomous spines',
    fact: 'A lionfish hunts with its fins. It spreads those long striped fins like a net to herd little fish into a corner, then swallows one with a gulp so fast you would miss it. The spines along its back carry venom, so most hunters leave it alone. Here in the Indian Ocean, this is its true home.',
    night: 'As the light fades the lionfish wakes up and starts to prowl. It drifts slowly along the reef through the night, fins spread wide, cornering sleepy fish and shrimp against the coral. By morning it is tucked under a ledge again.',
  },

  giantMoray: {
    name: 'Giant moray',
    sci: 'Gymnothorax javanicus',
    group: 'fish',
    size: 'up to about two and a half metres long',
    where: 'its head poking from a hole in the wall',
    hook: 'An eel with two sets of jaws',
    fact: 'A giant moray has two sets of jaws. The second pair sits deep in its throat, and when the moray bites, those throat jaws shoot forward, grab the food, and drag it down. It opens and closes its mouth all day, which looks fierce, but it is only pumping water over its gills to breathe.',
    night: 'The giant moray does its hunting after dark. It slides out of its hole and pokes its nose into every crack, following its sharp sense of smell rather than its weak eyes, searching for sleeping fish and octopus.',
  },

  blacktipReefShark: {
    name: 'Blacktip reef shark',
    sci: 'Carcharhinus melanopterus',
    group: 'fish',
    size: 'about one and a half metres long',
    where: 'cruising the shallow edge of the lagoon',
    hook: 'A shark that is shy of people',
    fact: 'This shark is more scared of you than you are of it. Blacktip reef sharks patrol water so shallow that their black tipped fins sometimes poke above the surface, but they usually dart away when a person wades in. Like all sharks, it has no bones at all, only bendy cartilage, the same stuff as your ears.',
  },

  reefManta: {
    name: 'Reef manta ray',
    sci: 'Mobula alfredi',
    group: 'fish',
    size: 'wings about three metres across',
    where: 'flying slowly along the reef wall',
    hook: 'A gentle giant with wings',
    fact: 'A reef manta can be wider than a car, yet it eats creatures smaller than a grain of rice. It swims with its mouth open, scooping up clouds of plankton, and often loops over and over to stay in a thick patch. It has no stinger. Every manta has its own pattern of belly spots, like a fingerprint.',
  },

  eagleRay: {
    name: 'Spotted eagle ray',
    sci: 'Aetobatus ocellatus',
    group: 'fish',
    size: 'wings about one and a half metres across',
    where: 'gliding over the sandy slope',
    hook: 'The ray that leaps from the sea',
    fact: 'A spotted eagle ray sometimes leaps clear out of the water and lands with a slap. Nobody is quite sure why. Underwater it flies like a bird, flapping its pointed wings, and it digs in the sand for clams and snails, which it crushes with flat plates of teeth. Its whip tail is longer than its body.',
  },

  dayOctopus: {
    name: 'Day octopus',
    sci: 'Octopus cyanea',
    group: 'invertebrate',
    size: 'arms spanning up to about a metre',
    where: 'a den in the rubble near the reef base',
    hook: 'Three hearts and a thousand disguises',
    fact: 'An octopus has three hearts, blue blood, and no bones at all. The day octopus can change its colour and even the texture of its skin in less than a second, melting into the coral until it vanishes. With no bones, it can squeeze through a gap the size of its eye.',
    night: 'When the light goes, the day octopus heads home to its den, a hole in the reef it may have dug itself. Outside the door lies a pile of empty crab and clam shells, the leftovers of its meals.',
  },

  cuttlefish: {
    name: 'Cuttlefish',
    sci: 'Sepia pharaonis',
    group: 'invertebrate',
    size: 'about forty centimetres long',
    where: 'hovering over the sand near the seagrass',
    hook: 'Ripples of colour across its skin',
    fact: 'A cuttlefish can send waves of colour rippling across its skin, like a living television screen. It has eight arms, plus two long hidden tentacles that shoot out in a flash to snatch a shrimp. Inside its body is a chalky white board called a cuttlebone, the same thing pet birds peck at in their cages.',
  },

  diademaUrchin: {
    name: 'Diadema urchin',
    sci: 'Diadema setosum',
    group: 'invertebrate',
    size: 'spines about twenty centimetres long',
    where: 'a black spiky ball in a crevice',
    hook: 'Senses shadows with no eyes',
    fact: 'A diadema urchin can tell when a shadow falls on it, even though it has no eyes. Its whole body senses light, and it swings its long black needles toward anything that comes near. The spines are thin and sharp and break off in skin, so give it space. Look for the bright orange ring on top.',
    night: 'By day the urchin hides in a crevice with only its spines showing. When night falls it creeps out on hundreds of tiny tube feet and grazes algae off the rock, then finds its way back to the same hiding spot before dawn.',
  },

  blueSeaStar: {
    name: 'Blue sea star',
    sci: 'Linckia laevigata',
    group: 'invertebrate',
    size: 'about thirty centimetres across',
    where: 'lying on the reef flat in the sun',
    hook: 'One arm can grow a new star',
    fact: 'If a blue sea star loses an arm, the arm can grow a whole new sea star. The star grows a new arm too, and for a while you can find lopsided stars and tiny stars with one big arm. It has no brain and no blood, and it creeps along on hundreds of tube feet filled with seawater.',
  },

  seaCucumber: {
    name: 'Sea cucumber',
    sci: 'Holothuria atra',
    group: 'invertebrate',
    size: 'about twenty-five centimetres long',
    where: 'on the sand of the lagoon floor',
    hook: 'The reef vacuum cleaner',
    fact: 'A sea cucumber eats sand. It shovels sand and mud into its mouth all day with a ring of sticky tentacles, digests the tiny bits of food hidden in it, and leaves behind a trail of clean sand. This one is black, and if you rubbed it, its skin could ooze a reddish liquid that fish find nasty.',
    night: 'Sea cucumbers never stop eating. Through the night this one keeps creeping over the sand, tentacles working, while the reef fish that might nibble it are asleep. It often wears a coat of sand grains stuck to its skin.',
  },

  crownOfThorns: {
    name: 'Crown-of-thorns starfish',
    sci: 'Acanthaster planci',
    group: 'invertebrate',
    size: 'about thirty centimetres across',
    where: 'wrapped over a coral on the slope',
    hook: 'The starfish that eats coral',
    fact: 'The crown of thorns starfish eats living coral. It climbs onto a coral, pushes its stomach out through its mouth, spreads it over the polyps, and digests them, leaving a bare white skeleton behind. It can have more than a dozen arms, all covered in venomous spines. When too many appear at once, they can strip a whole reef.',
  },

  nudibranch: {
    name: 'Nudibranch',
    sci: 'Chromodoris',
    group: 'invertebrate',
    size: 'about five centimetres long',
    where: 'a tiny bright slug on a sponge',
    hook: 'A slug that wears its gills outside',
    fact: 'This sea slug wears its gills on the outside. The feathery tuft on its back is how it breathes, and the two horns on its head smell the water for food. It has no shell, so its bright colours are a warning. It eats sponges and stores their bad tasting chemicals in its body, so fish leave it alone.',
  },

  snappingShrimp: {
    name: 'Snapping shrimp',
    sci: 'Alpheus',
    group: 'invertebrate',
    size: 'about four centimetres long',
    where: 'a burrow in the sand with a goby lookout',
    hook: 'The crackle you hear underwater',
    fact: 'That crackling sound you hear underwater is thousands of these shrimp. A snapping shrimp slams its big claw shut so fast that it fires a bubble, and when the bubble collapses it makes a crack louder than almost any other animal can make, and stuns tiny prey. Many share a burrow with a goby fish, who keeps watch while the shrimp digs.',
  },

  hawksbillTurtle: {
    name: 'Hawksbill turtle',
    sci: 'Eretmochelys imbricata',
    group: 'reptile',
    size: 'shell about seventy centimetres long',
    where: 'nibbling sponges on the reef wall',
    hook: 'A beak like a hawk',
    fact: 'A hawksbill turtle eats sponges that most other animals cannot eat. Its narrow pointed beak, like the beak of a hawk, reaches into cracks in the reef to tear them out. The pretty amber and brown plates on its shell were once carved into combs and jewellery, which is why this gentle turtle became so rare.',
  },

  greenTurtle: {
    name: 'Green turtle',
    sci: 'Chelonia mydas',
    group: 'reptile',
    size: 'shell up to about a metre long',
    where: 'grazing in the seagrass meadow',
    hook: 'Green on the inside, not outside',
    fact: 'A green turtle is not green on the outside. Its name comes from the greenish fat under its shell, which people think comes from all the seagrass and algae it eats. Adults graze on seagrass meadows like cows in a field, and a female swims back across the ocean to lay her eggs on the very beach where she hatched.',
  },

  seaKrait: {
    name: 'Banded sea krait',
    sci: 'Laticauda colubrina',
    group: 'reptile',
    size: 'about a metre long',
    where: 'winding along the reef wall',
    hook: 'The sea snake that comes ashore',
    fact: 'This sea snake comes ashore. The banded sea krait hunts eels in the reef, but it climbs out onto rocks and beaches to rest, warm up, and lay its eggs. Its flat paddle tail pushes it through the water. Its venom is strong, yet it is a calm snake that almost never bites people and would rather slip away.',
  },

  spinnerDolphin: {
    name: 'Spinner dolphin',
    sci: 'Stenella longirostris',
    group: 'mammal',
    size: 'about two metres long',
    where: 'out in the blue beyond the reef',
    hook: 'The dolphin that spins in the air',
    fact: 'A spinner dolphin leaps out of the sea and spins like a top, sometimes several times in one jump, before splashing back down. No one is completely sure why. These dolphins live in big groups and find their food in the dark using clicks, listening for the echoes that bounce back.',
    night: 'By day spinner dolphins rest in the calm shallow lagoon, swimming slowly in a tight group. As evening comes they head out past the reef into deep water, where they dive after fish and squid that rise toward the surface in the dark.',
  },

  dugong: {
    name: 'Dugong',
    sci: 'Dugong dugon',
    group: 'mammal',
    size: 'about three metres long',
    where: 'grazing the seagrass in the lagoon',
    hook: 'The sea cow behind mermaid tales',
    fact: 'Old stories of mermaids told by sailors may have begun with this animal. The dugong is a gentle sea mammal that grazes on seagrass like a cow in a meadow, coming up for air every few minutes. Its closest living relatives on land are elephants. In the Andaman islands it is the state animal.',
  },

  chromis: { name: 'Blue-green chromis', sci: 'Chromis viridis', group: 'fish', size: 'about eight centimetres long', where: 'in a shimmering cloud above a branching coral', hook: 'A whole cloud that vanishes at once',
    fact: 'Swim closer and watch. The whole cloud drops into the coral in less than a second, every fish into its own gap between the branches, and then they all drift back out together. One coral head can be home to hundreds, and they sleep wedged in the very same gaps at night.' },
  anthias: { name: 'Scalefin anthias', sci: 'Pseudanthias squamipinnis', group: 'fish', size: 'about ten centimetres long', where: 'in orange clouds beside the reef walls', hook: 'Every one was born a girl',
    fact: 'Every one of these orange fish was born female. Each group is ruled by a single purple male, and if he dies, the biggest female changes into a male and takes his place, turning purple in about two weeks.' },
  fusilier: { name: 'Yellowback fusilier', sci: 'Caesio xanthonota', group: 'fish', size: 'about twenty-five centimetres long', where: 'streaming past in open water above the reef', hook: 'Blue by day, red by night',
    fact: 'Fusiliers are the day shift. They stream over the reef in fast blue ribbons, picking plankton out of the water. At night they tuck into the reef and turn a dull red. Red light cannot reach down here, so a red fish in the dark is almost invisible.' },
  bluestripeSnapper: { name: 'Bluestripe snapper', sci: 'Lutjanus kasmira', group: 'fish', size: 'about twenty-five centimetres long', where: 'hanging in a tight yellow crowd beside a bommie', hook: 'A crowd that only waits',
    fact: 'These snappers spend the whole day doing almost nothing. They hang together in a tight yellow crowd, barely moving, like passengers waiting for a train. Only after dark does the crowd break up, and each fish slips off alone to hunt crabs and shrimp across the sand.' },
  sweetlips: { name: 'Oriental sweetlips', sci: 'Plectorhinchus vittatus', group: 'fish', size: 'about fifty centimetres long', where: 'resting under a ledge in the coral garden', hook: 'Its baby pretends to be a worm',
    fact: 'A baby sweetlips looks nothing like this. It is brown with white blotches, and it swims with a wild wriggle that never stops. Scientists think it is copying a poisonous flatworm, so that hungry fish leave it alone. Only when it grows up does it get these stripes and thick lips.' },
  napoleonWrasse: { name: 'Humphead wrasse', sci: 'Cheilinus undulatus', group: 'fish', size: 'up to about two metres long', where: 'cruising slowly through the coral garden', hook: 'The giant that eats poison',
    fact: 'This gentle giant can grow longer than a tall man and live for thirty years. It is one of the very few animals that eats poisonous things, such as crown-of-thorns starfish and boxfish. The maze of lines on its face is different on every fish, like a fingerprint.' },
  bluefinTrevally: { name: 'Bluefin trevally', sci: 'Caranx melampygus', group: 'fish', size: 'about sixty centimetres long', where: 'racing over the reef in a small pack', hook: 'The hunter that follows other hunters',
    fact: 'A trevally is clever enough to let others do the work. It often shadows a hunting octopus or a moray eel, hovering just behind. When the hunter pokes into a crack and a frightened little fish bolts out the other side, the trevally is already there to snap it up.' },
  barracuda: { name: 'Great barracuda', sci: 'Sphyraena barracuda', group: 'fish', size: 'about one and a half metres long', where: 'hanging still just under the surface', hook: 'Still as a stick, then gone',
    fact: 'A barracuda can hang in the water as still as a stick, then shoot forward faster than your eye can follow. It hunts by sight and is drawn to anything that flashes like a silver fish, which is why divers are told to leave shiny jewellery in the boat.' },
  bannerfish: { name: 'Schooling bannerfish', sci: 'Heniochus diphreutes', group: 'fish', size: 'about eighteen centimetres long', where: 'in a loose school above the far bommies', hook: 'The Moorish idol lookalike',
    fact: 'Almost everyone thinks this is a Moorish idol, and almost everyone is wrong. The bannerfish is a butterflyfish that only looks like one, and the two are not close relatives at all. To tell them apart, look at the face. The real idol has a long snout with an orange saddle on it.' },
  pufferfish: { name: 'Blackspotted puffer', sci: 'Arothron nigropunctatus', group: 'fish', size: 'about twenty-five centimetres long', where: 'pottering slowly near the start of the channel', hook: 'Tap it and see',
    fact: 'When a puffer is scared it gulps water until it is a ball too big to swallow. Its body also carries a poison far stronger than cyanide. The puffer does not make the poison itself. Bacteria in its food make it, and the fish stores it. Its name means four teeth, fused into a beak.' },
  boxfish: { name: 'Yellow boxfish', sci: 'Ostracion cubicus', group: 'fish', size: 'babies are the size of a dice', where: 'a tiny yellow cube tucked in beside a coral', hook: 'A fish built like a box',
    fact: 'This baby is a swimming box. Under its skin is a case of bone, so it cannot bend its body at all and paddles along with tiny fins like a little drone. Its yellow and black spots are a warning. When frightened it leaks poison from its skin. Car makers once copied its shape for a car.' },
  trumpetfish: { name: 'Trumpetfish', sci: 'Aulostomus chinensis', group: 'fish', size: 'about sixty centimetres long', where: 'hovering like a stick among the corals', hook: 'It hides behind other fish',
    fact: 'A trumpetfish is a sneak. It hangs upright among the branches, pretending to be a stick. To get close to its prey it swims right alongside a big harmless fish, hiding behind it like a shadow. Then its mouth opens like the end of a trumpet and sucks the victim in.' },
  bumpheadParrotfish: { name: 'Bumphead parrotfish', sci: 'Bolbometopon muricatum', group: 'fish', size: 'over a metre long', where: 'grazing in a herd at the far end of the garden', hook: 'Five tonnes of sand a year',
    fact: 'One bumphead parrotfish bites off and grinds up about five tonnes of reef every year, and nearly all of it comes out as sand. They travel in herds like buffalo, and you can hear them crunching from far away. The males crash their bony foreheads together like rams.' },
  whaleShark: { name: 'Whale shark', sci: 'Rhincodon typus', group: 'fish', size: 'as long as a bus', where: 'far out in the blue past the drop-off', hook: 'Teeth on its eyeballs',
    fact: 'The biggest fish in the sea eats some of the smallest things in it, sieving plankton through a mouth more than a metre wide. Its eyeballs are covered in tiny teeth for armour. And its spots are so like a starry sky that scientists identify each shark with software built to map stars.' },
  needlefish: { name: 'Needlefish', sci: 'Tylosurus crocodilus', group: 'fish', size: 'about fifty centimetres long', where: 'right under the surface, look up', hook: 'A fish with green bones',
    fact: 'Needlefish live in the top few centimetres of the sea, where their silver sides vanish against the mirror of the surface. They can skip across the water on their tails. And if you ever saw one on a plate you would get a shock, because their bones are bright green.' },
  gardenEel: { name: 'Spotted garden eel', sci: 'Heteroconger hassi', group: 'fish', size: 'about forty centimetres long, mostly hidden', where: 'a field of thin stalks on the sand behind the boat', hook: 'It never leaves home',
    fact: 'A garden eel never leaves its burrow, not once in its whole life. It keeps its tail in the hole and sways in the current like grass, picking tiny animals out of the water as they drift by. Come too close and the whole garden sinks into the sand. They even find a mate by stretching across to a neighbour.' },
  moonJelly: { name: 'Moon jellyfish', sci: 'Aurelia aurita', group: 'invertebrate', size: 'about the size of a dinner plate', where: 'drifting near the surface out beyond the boat', hook: 'No brain, no heart, no problem',
    fact: 'A jellyfish has no brain, no heart, no blood and no bones. It is mostly water. And yet jellyfish have been drifting through the sea for more than five hundred million years. That is before the dinosaurs, and even before there were trees.' },
  featherStar: { name: 'Feather star', sci: 'Crinoidea', group: 'invertebrate', size: 'about twenty centimetres across', where: 'perched like a fern on top of corals', hook: 'A fern that walks and swims',
    fact: 'It looks like a fern, but this is an animal, a cousin of the sea stars, and its family is older than the dinosaurs. It holds on with little claws, and it can walk. If it wants to move faster it lets go and swims, beating its feathery arms up and down.' },
  seaSquirt: { name: 'Sea squirt', sci: 'Ascidiacea', group: 'invertebrate', size: 'each one smaller than a thumb', where: 'little coloured vases in clusters on the rock', hook: 'It eats its own brain',
    fact: 'Of all the animals here without a backbone, this little bag is your closest relative. Its baby swims like a tadpole, with an eye, a brain and a nerve cord down its back. Then it glues its head to a rock and absorbs most of its own brain, because it will never need to think again.' },
  mantisShrimp: { name: 'Peacock mantis shrimp', sci: 'Odontodactylus scyllarus', group: 'invertebrate', size: 'about fifteen centimetres long', where: 'peering from a burrow in the rubble', hook: 'The fastest punch in the sea',
    fact: 'This shrimp throws the fastest punch of any animal. Its club flies out as fast as a bullet leaving a gun, so fast that the water in front of it boils and flashes. It can crack a crab shell or even aquarium glass. Its eyes are stranger still, with twelve kinds of colour sensor where we have three.' },
  hermitCrab: { name: 'Hermit crab', sci: 'Dardanus', group: 'invertebrate', size: 'about six centimetres long', where: 'trundling across the sand in a borrowed shell', hook: 'They queue to swap houses',
    fact: 'A hermit crab wears a shell that some snail left behind, and as it grows it needs a bigger one. When a good empty shell turns up, crabs gather and line up from biggest to smallest. The biggest takes the new shell, and then everyone moves up one house, all at once.' },
  seahorse: { name: 'Seahorse', sci: 'Hippocampus kuda', group: 'fish', size: 'about fifteen centimetres tall', where: 'holding a blade of seagrass with its tail', hook: 'The father has the babies',
    fact: 'In seahorses it is the father who gets pregnant. The mother places her eggs in a pouch on his belly, and he carries them until hundreds of tiny seahorses pop out. A seahorse has no stomach, so it must eat almost all day, and its two eyes can look in different directions at once.' },
  flounder: { name: 'Leopard flounder', sci: 'Bothus pantherinus', group: 'fish', size: 'about twenty-five centimetres long', where: 'flat on the sand near the anchor, almost invisible', hook: 'One eye moved across its face',
    fact: 'This fish was born looking normal, with one eye on each side of its head. Then, as it grew, one eye slowly travelled over the top of its head to join the other. Now it lies on its side with both eyes looking up, and it can repaint its skin to match the sand in seconds.' },
  cleanerShrimp: { name: 'Cleaner shrimp', sci: 'Lysmata amboinensis', group: 'invertebrate', size: 'about five centimetres long', where: 'right beside the moray eel, waving white feelers', hook: 'It climbs inside the eel\'s mouth',
    fact: 'This little shrimp is a dentist with very dangerous customers. It waves its long white feelers like a shop sign, and then it climbs right inside the mouth of a moray eel to pick its teeth clean. The eel never bites. And every one of these shrimp is both a male and a female at the same time.' },
};
