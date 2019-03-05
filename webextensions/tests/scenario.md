# Scenario for manual tests


## Drag and drop of tabs partially highlighted in a tree

### Setup

* Prepare tabs as:
  - A
    - B
      - C
    - D
    - E

### Test

1. Activate B.
2. Ctrl-Click on D.
3. Drag B (and D) above A.
   * Expected result: tree becomes:
     - B
     - D
     - A
       - C
       - E


## Auto fixup of tree with visible tabs

### Setup

* Install [Conex](https://addons.mozilla.org/ja/firefox/addon/conex/).
* Tree Behavior => When visibility of tabs are changed by other addons => Fix up tree structure with visible tabs automatically
* Prepare tabs as:
  - A
    - B (with the "Personal" container)
      - C (with the "Personal" container)
        - D
          - E
    - F (with the "Personal" container)
      - G (with the "Personal" container)
    - H
* Open Conex's options page.

### Test

1. Turn on Conex's option "only show tabs of the current container".
   * Expected result: tree becomes:
     - A
       - D
         - E
       - H
2. Turn off Conex's option "only show tabs of the current container".
   * Expected result: tree becomes:
     - A
       - B
         - C
       - D
         - E
       - F
         - G
       - H

