"""Build the checked-in, child-friendly flag catalogue from /tmp/flag-countries.json."""
import json, re
from pathlib import Path

ROOT = Path(__file__).parent
countries = json.loads(Path('/tmp/flag-countries.json').read_text())
clues = {}

def add(code, *items):
    clues[code] = [{'text': t, 'box': b} for t,b in items]

def horizontal(code, colors):
    colors = colors.split(',')
    words = ['at the top', 'in the middle', 'at the bottom'] if len(colors)==3 else ['at the top','at the bottom']
    add(code, *[(f'{color.capitalize()} {words[i]}.', [0,i*100/len(colors),100,100/len(colors)]) for i,color in enumerate(colors)])

def vertical(code, colors):
    colors = colors.split(',')
    words = ['on the left','in the middle','on the right']
    add(code, *[(f'{color.capitalize()} {words[i]}.',[i*100/3,0,100/3,100]) for i,color in enumerate(colors)])

for line in '''AM:red,blue,orange
AT:red,white,red
BG:white,green,red
BO:red,yellow,green
BW:blue,black,blue
CO:yellow,blue,red
DE:black,red,gold
EE:blue,black,white
GA:green,yellow,blue
GM:red,blue,green
HU:red,white,green
ID:red,white
LT:yellow,green,red
LU:red,white,light blue
LV:dark red,white,dark red
MC:red,white
NL:red,white,blue
PL:white,red
RU:white,blue,red
SL:green,white,blue
UA:blue,yellow
YE:red,white,black'''.splitlines():
    code, colors=line.split(':'); horizontal(code,colors)

for line in '''BE:black,yellow,red
CI:orange,white,green
FR:blue,white,red
GN:red,yellow,green
IE:green,white,orange
IT:green,white,red
ML:green,yellow,red
NG:green,white,green
PE:red,white,red
RO:blue,yellow,red
TD:dark blue,yellow,red'''.splitlines():
    code, colors=line.split(':'); vertical(code,colors)

# Each box uses percentages of the actual flag, not a cropped thumbnail.
special = '''CL|A white star in a blue corner.~0,0,33,50|White above. Red below.~33,0,67,100
IN|Saffron at the top.~0,0,100,33|A blue wheel in the middle.~40,33,20,34|Green at the bottom.~0,67,100,33
JP|A big red circle.~29,19,42,62|White all around it.~0,0,100,100
BD|A red circle, a little to the left.~22,14,42,72|A green background.~0,0,100,100
PW|A yellow circle, a little to the left.~20,15,40,70|A blue background.~0,0,100,100
CA|One red maple leaf.~35,16,30,68|Red on both sides.~0,0,25,100
BR|A yellow diamond.~7,9,86,82|A blue circle inside it.~33,25,34,50
CN|One big yellow star.~8,8,22,33|Four little stars next to it.~27,4,20,43
US|A blue corner full of stars.~0,0,40,54|Red and white stripes.~42,0,58,100
GB|A big red cross.~0,34,100,32|Diagonal crosses too.~0,0,100,100
AU|A little British flag in the corner.~0,0,50,50|White stars on dark blue.~48,0,52,100
NZ|A little British flag in the corner.~0,0,50,50|Four red stars with white edges.~50,10,44,78
ZA|A green sideways Y.~0,0,80,100|A black triangle on the left.~0,19,30,62
NP|Two triangle shapes, one above the other.~0,0,100,100|A white moon and a white sun.~10,25,52,60
CH|One big white plus sign.~20,20,60,60|A red square flag.~0,0,100,100
KR|A red and blue circle.~34,26,32,48|Four groups of black bars.~14,12,72,76
PK|A white crescent moon and star.~39,17,44,66|A white strip on the left.~0,0,25,100
TR|A white crescent moon.~23,20,34,60|A white star beside it.~54,32,23,36
TN|A white circle on red.~32,24,36,52|A red crescent and star inside.~38,33,24,34
VN|One big yellow star.~26,16,48,68|Red all around it.~0,0,100,100
SO|One white star.~28,20,44,60|A sky-blue background.~0,0,100,100
IL|A blue six-pointed star.~35,28,30,44|A blue stripe above and below.~0,12,100,76
SE|A yellow cross.~0,36,100,28|Blue around the cross.~0,0,100,100
FI|A blue cross.~0,35,100,30|White around the cross.~0,0,100,100
DK|A white cross, closer to the left.~25,0,16,100|Red around the cross.~0,0,100,100
NO|A blue cross with white edges.~24,0,22,100|A red background.~0,0,100,100
IS|A red cross with white edges.~24,0,22,100|A blue background.~0,0,100,100
GR|A white cross in a blue corner.~0,0,37,56|Blue and white stripes.~38,0,62,100
AR|A little golden sun.~40,34,20,32|Sky blue, white, sky blue.~0,0,100,100
UY|A golden sun in the corner.~3,3,34,47|Blue and white stripes.~40,0,60,100
MX|An eagle in the white middle.~37,27,26,46|Green on the left. Red on the right.~0,0,100,100
ES|A wide yellow stripe.~0,25,100,50|A small coat of arms, left of centre.~22,30,21,40
PT|A round shield on the colour line.~26,24,28,52|Green on the left. More red on the right.~0,0,100,100
JM|A yellow diagonal cross.~0,0,100,100|Green triangles above and below.~25,0,50,100
KE|A red, black and white shield.~36,16,28,68|Black, red and green stripes.~0,0,100,100
TZ|A black diagonal stripe with yellow edges.~0,0,100,100|Green above. Blue below.~0,0,100,100
UG|A bird inside a white circle.~35,27,30,46|Black, yellow and red stripes, twice.~0,0,100,100
GH|One black star in the middle.~38,33,24,34|Red, yellow and green stripes.~0,0,100,100
ET|A yellow star inside a blue circle.~30,20,40,60|Green, yellow and red stripes.~0,0,100,100
EG|A golden eagle in the middle.~42,35,16,30|Red, white and black stripes.~0,0,100,100
MA|A green five-pointed star.~34,27,32,46|A red background.~0,0,100,100
DZ|A red crescent moon and star.~36,23,28,54|Green on the left. White on the right.~0,0,100,100
SA|White writing near the middle.~16,20,68,37|A white sword below the writing.~24,64,52,12
AE|A red stripe down the left.~0,0,25,100|Green, white and black beside it.~25,0,75,100
QA|A zigzag edge with nine white points.~27,0,20,100|A deep maroon colour.~47,0,53,100
BH|A zigzag edge with five white points.~25,0,24,100|Bright red on the right.~49,0,51,100
KW|A black shape on the left.~0,0,25,100|Green, white and red stripes.~25,0,75,100
OM|A little white emblem at the top left.~3,4,19,25|White, red and green beside a red stripe.~0,0,100,100
JO|A white star in a red triangle.~10,38,13,24|Black, white and green stripes.~50,0,50,100
PS|A red triangle on the left.~0,0,40,100|Black, white and green stripes.~40,0,60,100
LB|A green cedar tree.~33,27,34,46|Red above and below the white.~0,0,100,100
IQ|Green writing in the middle.~26,39,48,22|Red, white and black stripes.~0,0,100,100
IR|A small red symbol in the middle.~39,34,22,32|Green above and red below.~0,0,100,100
SY|Three red stars in a row.~15,35,70,30|Green, white and black stripes.~0,0,100,100
AF|A white emblem in the centre.~32,15,36,70|Black, red and green vertical stripes.~0,0,100,100
LK|A golden lion holding a sword.~43,17,45,68|Orange and green strips on the left.~6,10,23,80
BT|A white dragon across the middle.~16,13,68,74|Yellow above. Orange below.~0,0,100,100
MV|A white crescent inside a green box.~23,24,54,52|A thick red border.~0,0,100,100
MM|One big white star.~28,18,44,64|Yellow, green and red stripes.~0,0,100,100
TH|A wide blue stripe in the middle.~0,33,100,34|Red edges with white stripes inside.~0,0,100,100
KH|A white temple in the middle.~28,29,44,42|Red between two blue stripes.~0,0,100,100
LA|A white circle in the middle.~33,25,34,50|A wide blue stripe between red stripes.~0,0,100,100
MY|A yellow crescent and star in a blue corner.~0,0,50,57|Red and white stripes.~50,0,50,100
SG|A white crescent and five stars.~10,5,31,40|Red above. White below.~0,0,100,100
BN|A red emblem in the middle.~34,20,32,62|White and black stripes across yellow.~0,0,100,100
PH|A yellow sun in a white triangle.~0,0,47,100|Blue above. Red below.~48,0,52,100
TL|A white star inside a black triangle.~0,15,34,70|A yellow triangle peeks out behind it.~0,0,50,100
MN|A golden symbol on the left.~7,14,19,70|Red, blue and red vertical stripes.~0,0,100,100
KZ|A golden sun and eagle.~38,22,37,56|A golden pattern down the left.~3,0,12,100
KG|A yellow sun with a round red centre.~31,20,38,60|A red background.~0,0,100,100
UZ|A crescent and stars at the top left.~4,3,24,27|Blue, white and green stripes.~0,0,100,100
TJ|A golden crown and seven stars.~36,33,28,34|Red, white and green stripes.~0,0,100,100
TM|A patterned red strip near the left.~12,0,18,100|A white crescent and five stars.~35,5,22,33
AZ|A white crescent and star.~39,35,23,29|Blue, red and green stripes.~0,0,100,100
GE|One big red cross.~0,40,100,20|Four little red crosses.~7,7,86,86
AL|A black two-headed eagle.~25,14,50,72|A red background.~0,0,100,100
AD|A coat of arms in the yellow middle.~37,24,27,52|Blue, yellow and red vertical stripes.~0,0,100,100
BA|A large yellow triangle.~24,0,50,100|White stars along a diagonal line.~18,0,65,100
BY|A red and white pattern on the left.~0,0,12,100|A big red stripe over a smaller green one.~12,0,88,100
HR|A red and white checkerboard shield.~38,24,24,52|Red, white and blue stripes.~0,0,100,100
CZ|A blue triangle on the left.~0,0,50,100|White above. Red below.~50,0,50,100
CY|An orange island shape.~28,20,47,42|Two green olive branches underneath.~33,65,38,20
LI|A golden crown at the top left.~8,10,22,27|Blue above. Red below.~0,0,100,100
MT|A small cross at the top left.~4,6,15,22|White on the left. Red on the right.~0,0,100,100
MD|An eagle in the yellow middle.~37,27,26,46|Blue, yellow and red stripes.~0,0,100,100
ME|A golden two-headed eagle.~31,17,38,66|A golden border around red.~0,0,100,100
MK|A yellow sun in the middle.~39,34,22,32|Eight yellow rays reach the edges.~0,0,100,100
RS|A shield and crown, left of centre.~20,18,24,66|Red, blue and white stripes.~0,0,100,100
SK|A shield with a white double cross.~20,26,26,48|White, blue and red stripes.~0,0,100,100
SI|A little mountain shield at the top left.~15,17,16,35|White, blue and red stripes.~0,0,100,100
SM|A coat of arms in the middle.~33,23,34,54|White above. Light blue below.~0,0,100,100
VA|Crossed keys in the white half.~55,25,38,54|Yellow on the left. White on the right.~0,0,100,100
AO|A yellow star, gear and machete.~31,21,38,58|Red above. Black below.~0,0,100,100
BJ|A green stripe down the left.~0,0,40,100|Yellow above red on the right.~40,0,60,100
BF|A yellow star in the middle.~37,32,26,36|Red above. Green below.~0,0,100,100
BI|Three red stars inside a white circle.~32,24,36,52|A white diagonal cross.~0,0,100,100
CV|Ten yellow stars in a ring.~16,38,38,55|A red stripe between two white stripes.~0,50,100,25
CM|A yellow star in the red middle.~40,35,20,30|Green, red and yellow stripes.~0,0,100,100
CF|One red stripe goes straight down.~40,0,20,100|A yellow star at the top left.~4,2,17,23
KM|A white crescent and four stars.~8,27,19,48|Four stripes: yellow, white, red and blue.~50,0,50,100
CG|A yellow diagonal stripe.~0,0,100,100|Green above it. Red below it.~0,0,100,100
CD|A yellow star at the top left.~3,4,27,36|A red diagonal stripe with yellow edges.~0,0,100,100
DJ|A red star in a white triangle.~8,35,23,30|Blue above. Green below.~50,0,50,100
GQ|A little tree shield in the middle.~42,35,18,30|A blue triangle on the left.~0,0,25,100
ER|A golden olive wreath in a red triangle.~9,21,28,58|Green above. Blue below.~45,0,55,100
SZ|A black and white shield.~23,28,54,44|Blue and yellow stripes around red.~0,0,100,100
GW|A black star on a red strip.~6,34,23,32|Yellow above green on the right.~33,0,67,100
LS|A black hat in the middle.~37,35,26,30|Blue, white and green stripes.~0,0,100,100
LR|One white star in a blue corner.~0,0,28,46|Red and white stripes.~28,0,72,100
LY|A white crescent and star.~38,33,24,34|A wide black stripe between red and green.~0,0,100,100
MG|A white stripe down the left.~0,0,33,100|Red above green on the right.~33,0,67,100
MW|A red rising sun at the top.~33,6,34,26|Black, red and green stripes.~0,0,100,100
MR|A golden crescent and star.~27,28,46,44|Red edges around a green middle.~0,0,100,100
MU|Four stripes: red, blue, yellow, green.~0,0,100,100|Yellow sits just above green.~0,50,100,50
MZ|A yellow star with a book, hoe and rifle.~2,26,25,48|Green, black and yellow stripes.~45,0,55,100
NA|A yellow sun in the blue corner.~6,8,25,37|A red diagonal stripe with white edges.~0,0,100,100
NE|An orange circle in the white stripe.~38,35,24,30|Orange above. Green below.~0,0,100,100
RW|A yellow sun at the top right.~73,5,22,33|A wide blue stripe above yellow and green.~0,0,100,100
ST|Two black stars in the yellow stripe.~43,37,41,26|A red triangle on the left.~0,0,25,100
SN|A green star in the yellow middle.~40,34,20,32|Green, yellow and red stripes.~0,0,100,100
SC|Five colours fan out from one corner.~0,0,100,100|Blue, yellow, red, white and green.~0,0,100,100
SS|A yellow star in a blue triangle.~8,30,22,38|Black, red and green stripes.~50,0,50,100
SD|A green triangle on the left.~0,0,33,100|Red, white and black stripes.~35,0,65,100
TG|A white star in a red corner.~0,0,39,60|Green and yellow stripes.~40,0,60,100
ZM|An orange eagle near the right.~65,31,30,24|Red, black and orange bars below it.~64,53,36,47
ZW|A golden bird in a white triangle.~4,29,22,42|Green, yellow, red and black stripes.~40,0,60,100
AG|A golden rising sun.~33,16,34,22|Red sides make a big V.~0,0,100,100
BS|A black triangle on the left.~0,0,34,100|A yellow stripe between blue stripes.~34,0,66,100
BB|A black trident in the middle.~39,26,22,48|Blue on each side of yellow.~0,0,100,100
BZ|Two people beside a tree in a circle.~29,15,42,70|Thin red stripes at the top and bottom.~0,0,100,100
CR|A wide red stripe in the middle.~0,33,100,34|Blue edges, with white stripes inside.~0,0,100,100
CU|A white star in a red triangle.~7,32,24,36|Blue and white stripes.~50,0,50,100
DM|A parrot inside a red circle.~33,23,34,54|A yellow, black and white cross.~0,0,100,100
DO|A white cross makes four boxes.~0,39,100,22|Blue and red boxes.~0,0,100,100
SV|A small coat of arms in the middle.~39,34,22,32|Blue, white and blue stripes.~0,0,100,100
GD|A yellow star in a red circle.~39,35,22,30|Six more stars in the red border.~0,0,100,100
GT|A bird and scroll in the white middle.~37,23,26,54|Sky blue on both sides.~0,0,100,100
HT|A tiny picture in a white box.~37,39,26,34|Blue above. Red below.~0,0,100,100
HN|Five blue stars in the white stripe.~34,37,32,26|Blue above and below.~0,0,100,100
NI|A little triangle in the middle.~40,37,20,26|Blue, white and blue stripes.~0,0,100,100
PA|A blue star and a red star.~0,0,100,100|Four boxes: white, red, blue, white.~0,0,100,100
KN|Two white stars on a black stripe.~19,24,62,52|Yellow edges around the diagonal stripe.~0,0,100,100
LC|A tall black and white triangle.~33,14,34,70|A smaller yellow triangle in front.~30,53,40,31
VC|Three green diamonds make a V.~35,27,30,45|Blue, yellow and green vertical stripes.~0,0,100,100
TT|A black diagonal stripe.~0,0,100,100|White edges on a red background.~0,0,100,100
EC|A coat of arms in the middle.~36,22,28,55|A wide yellow stripe above blue and red.~0,0,100,100
GY|A red triangle inside a yellow arrow.~0,0,95,100|Green around the arrow.~0,0,100,100
PY|A little round badge in the middle.~42,36,16,28|Red, white and blue stripes.~0,0,100,100
SR|A yellow star in the red middle.~37,32,26,36|Green edges and two white stripes.~0,0,100,100
VE|Eight white stars in a curved row.~29,35,42,28|Yellow, blue and red stripes.~0,0,100,100
FJ|A little British flag at the top left.~0,0,50,50|A shield on a light blue background.~66,24,23,50
KI|A golden bird above a rising sun.~30,8,40,45|Blue and white waves below.~0,54,100,46
MH|Orange and white diagonal rays.~0,0,100,100|A white star at the top left.~10,7,30,45
FM|Four white stars make a diamond.~27,17,46,66|A light blue background.~0,0,100,100
NR|A thin yellow line across the middle.~0,46,100,8|A white star below the line.~16,57,26,38
PG|A yellow bird on the red half.~51,10,39,51|Five white stars on the black half.~8,34,39,53
WS|Five white stars in a blue corner.~0,0,50,50|Red over the rest of the flag.~0,0,100,100
SB|Five white stars in a blue corner.~5,7,30,46|A yellow diagonal line separates blue and green.~0,0,100,100
TO|A red cross in a white corner.~0,0,42,50|Red over the rest of the flag.~0,0,100,100
TV|A little British flag at the top left.~0,0,50,50|Nine yellow stars on light blue.~40,22,57,74
VU|A yellow sideways Y.~0,0,100,100|A golden curl inside a black triangle.~7,32,20,36
KP|A red star inside a white circle.~17,29,29,42|A wide red stripe between blue edges.~0,0,100,100'''

for line in special.splitlines():
    code, *items=line.split('|')
    add(code,*[(item.split('~')[0],list(map(float,item.split('~')[1].split(',')))) for item in items])

# Unequal stripes need precise highlights.
clues['CO'][0]['box']=[0,0,100,50]; clues['CO'][1]['box']=[0,50,100,25]; clues['CO'][2]['box']=[0,75,100,25]
clues['BW']=[{'text':'A black stripe with white edges.','box':[0,37,100,26]}, {'text':'Light blue above and below.','box':[0,0,100,100]}]
clues['LV'][0]['box']=[0,0,100,40];clues['LV'][1]['box']=[0,40,100,20];clues['LV'][2]['box']=[0,60,100,40]
names={'CI':'Côte d’Ivoire','CD':'Democratic Republic of the Congo','CG':'Republic of the Congo','CV':'Cabo Verde','TR':'Türkiye'}
first='IN JP BD CA BR CH NP AU NZ CN US GB ZA KR PK BT LK SG SE FI IT FR UA JM AR KE TR VN PW SO'.split()
ordered=sorted(countries,key=lambda c:(first.index(c['cca2']) if c['cca2'] in first else 1000,c['name']['common']))
output=[]
for c in ordered:
    code=c['cca2']; name=names.get(code,c['name']['common'])
    assert code in clues, f'Missing clues: {code}'
    svg=(ROOT/'assets/flags'/f'{code.lower()}.svg').read_text()
    width=re.search(r'<svg[^>]*\bwidth="([\d.]+)"',svg); height=re.search(r'<svg[^>]*\bheight="([\d.]+)"',svg)
    if width and height: ratio=float(width[1])/float(height[1])
    else:
        vb=re.search(r'viewBox="([\d. -]+)"',svg)
        vals=list(map(float,vb[1].split())); ratio=vals[2]/vals[3]
    region=c['region']
    if region=='Americas': region='South America' if c['subregion']=='South America' else 'North America'
    output.append({'code':code.lower(),'name':name,'region':region,'ratio':round(ratio,6),'clues':clues[code]})
(ROOT/'data.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')))
print(f'Built {len(output)} countries with {sum(len(c["clues"]) for c in output)} visual clues.')
