// ==UserScript==
// @name         WaniKani Coming Up
// @namespace    wk_lai
// @version      1.0
// @description  Shows upcoming progression reviews concisely
// @require      http://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js
// @author       lai
// @match        *://www.wanikani.com/*
// @grant        GM_addStyle
// ==/UserScript==

(($) => {
  // Defined by WaniKani
  const unlockedAtKey = "unlockedAt";
  const availableAtKey = "availableAt";
  const passedAtKey = "passedAt";
  const srsStageKey = "srsStage";

  // Defined locally
  const valuesKey = "values";
  const latestKey = "latest";
  const availableAtMsKey = "availableAtMs";
  const availableInHoursKey = "availableInHours";
  const amountKey = "amount";
  const srsScoreKey = "srsScore";
  const timescaleHoursKey = "timescaleHours";
  const tagsKey = "tags";
  const passedKey = "passed";
  const allPassedKey = "allPassed";

  const srsScores = [0, 14400000, 43200000, 126000000, 295200000, 896400000, 2102400000, 4690800000, 15055200000];

  const groupBy = function (xs, key) {
    const getOrSetEmpty = (map, key) => {
      const result = map.get(key);
      if (result) return result;
      const newValue = [];
      map.set(key, newValue);
      return newValue
    };
    return xs.reduce((map, x) => {
      const group = getOrSetEmpty(map, x[key]);
      group.push(x);
      return map;
    }, new Map());
  };

  // won't work with sparse arrays
  const first = (arr) => arr[0];
  const last = (arr) => arr.slice(-1).pop();

  const orderBy = (arr, predicate) => arr.slice().sort(predicate);

  GM_addStyle(
    '.cu-value { font-size: 20px; height: 1.5em; width: 1.5em; line-height: 1.5em; }' +
    '.cu-group-root { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, auto)); grid-gap: 15px 20px; }' +
    '.cu-grid { display: grid; grid-column-gap: 4px; grid-template-columns: repeat(auto-fill, 30px); height: 30px; justify-content: space-between; overflow: hidden; position: relative; }' +
    '.cu-root { font-family: "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif; }' +
    '.cu-root:hover .cu-btn-settings { opacity: 1; }' +
    '.cu-btn-settings { opacity:0; transition: opacity .3s ease-out; display: inline-block; padding: 4px 12px; font-size: 16px; line-height: 20px; cursor: pointer; }' +
    '.cu-btn-settings:hover { color: #333; }' +
    '.cu-settings { display: grid; grid-template-columns: repeat(2, 80px auto); grid-gap: 15px 20px; align-items: center; margin-bottom: 10px; }' +
    '.cu-settings-root .control-group { display: flex; align-items: center; }' +
    '.cu-select { margin-bottom: 0; width: 80px; }' +
    '.cu-label { margin-bottom: 0; }' +
    '.cu-aside { font-family: "Ubuntu", Helvetica, Arial, sans-serif; }' +
    '.cu-group-head { position: relative; display: flex; padding-top: 2px;background: linear-gradient(180deg,  #999 calc(0px), #fff calc(1px), transparent calc(100%)); margin-bottom: 5px; }' +
    '.cu-group-number { padding: 2px; width: 18px; text-align: center; }' +
    '.cu-group-number.cu-all-passed { background-color: #08C66C; }' +
    '.cu-group-number.cu-not-all-passed { background-color: #7000a9; }' +
    '.cu-group-head .cu-group-number { border-radius: 0; }' +
    '.cu-group-time { font-size: 11.844px; color: rgba(0,0,0,0.6); padding: 2px 3px 0; line-height: 14px; }' +
    '.cu-timeline-root { height: 16px; margin-bottom: 13px; }' +
    '.cu-timeline-root:empty { display: none; }' +
    '.cu-time-axis { position: absolute; left: 0; right: 0; top: 0; height: 3px; border-top: 1px solid white; border-bottom: 1px solid white; }' +
    '.cu-indicator { position: absolute; transition: left .5s ease-out; }' +
    '[cu-inactive="true"] { opacity: .3; }' +
    '[cu-style="circle"] { margin-left: 8px; margin-right: 8px; }' +
    '[cu-style="circle"] .cu-time-axis { margin-left: -8px; margin-right: -8px; }' +
    '[cu-style="circle"] .cu-indicator { top: 2px; width: 16px; padding: 1px 0; font-size: 11.844px; line-height: 14px; border-radius: 8px; color: #fff; text-align: center; }' +
    '[cu-style="circle"] .cu-indicator.cu-all-passed { background-color: #08C66C; }' +
    '[cu-style="circle"] .cu-indicator.cu-not-all-passed { background-color: #7000a9; }' +
    '[cu-style="circle"] .cu-scale-end { width: 8px; }' +
    '[cu-style="cone"] { margin-left: 5px; margin-right: 5px; }' +
    '[cu-style="cone"] .cu-time-axis { margin-left: -5px; margin-right: -5px; }' +
    '[cu-style="cone"] .cu-indicator { top: 3px; padding: 0; width: 0px;  height: 0px; color: transparent; border-left: 5px solid transparent; border-right: 5px solid transparent; border-bottom: 10px solid; }' +
    '[cu-style="cone"] .cu-indicator.cu-all-passed { border-bottom-color: #08C66C; }' +
    '[cu-style="cone"] .cu-indicator.cu-not-all-passed { border-bottom-color: #7000a9; }' +
    '[cu-style="cone"] .cu-scale-end { width: 5px; }' +
    '.cu-tag { background-color: #fff; color: rgba(0,0,0,0.6); line-height: 14px; padding: 2px 4px; font-size: 11.844px; }' +
    '.cu-spacer { flex-grow: 1; }' +
    '.cu-scale { position: absolute; top: 2px; height: 6px; border-left: 1px solid #d8d8d8; border-right: 1px solid white; }' +
    '.cu-scale-end { position: absolute; left: 100%; top: 2px; height: 6px; width: 8px; background: linear-gradient(135deg, #d8d8d8 50%, transparent calc(50% + 1px)); }' +
    '.cu-scale-head { position: absolute; right: 0; bottom: 100%; font-size: 11.844px; line-height: 1em; color: #777; font-weight: 300; text-shadow: 0 1px 0 #fff;}' +
    '.cu-overflow-icon { position: absolute; top:0; left: 0; padding: 0; font-size: 14px; height: 100%; width: 100%; line-height: 2em; background: linear-gradient(-45deg, #5571e2, #294ddb); }'
  );

  class CuDataProvider {
    constructor(selector) {
      this.selector = selector;
      this.data;
    }
    getData() {
      if ( !this.data ) {
        this.data = $(this.selector).children("div").data("react-props").data;
      }
      return this.data;
    }
  }

  class CuDataService {
    constructor(timeService, dataProvider, settings) {
      this.timeService = timeService;
      this.dataProvider = dataProvider;
      this.settings = settings;
    }
    getDomainModel() {
      const rawData = this.dataProvider.getData();
      const unlockedItems = rawData.filter(v => v[unlockedAtKey]);
      const notYetPassedItems = this.filterPassedItems(unlockedItems);
      const groupedData = Array.from(groupBy(notYetPassedItems, availableAtKey));
      const filteredData = groupedData.filter(x => x[0] != null).filter(x => x[1].length);
      const enhancedGroups = filteredData.map(d => this.createEnhancedGroup(d));
      return this.createEnhancedTotal(enhancedGroups);
    }
    filterPassedItems(items) {
      if (this.settings.getShowPassed()) {
        return items;
      }
      return items.filter(i => !i[passedAtKey]);
    }

    findLowestSrsStage(values) {
      const lowOrdered = orderBy(values, (a, b) => a[srsStageKey] - b[srsStageKey]);
      const lowestValue = first(lowOrdered);
      return lowestValue[srsStageKey];
    }

    sortByLowestLevel(groups) {
      return orderBy(groups, (a, b) => a[srsScoreKey] - b[srsScoreKey]);
    }

    sortByLargestAmount(groups) {
      return orderBy(groups, (a, b) => b[amountKey] - a[amountKey]);
    }

    sortByFirstAvailable(groups) {
      return orderBy(groups, (a, b) => a[availableAtMsKey] - b[availableAtMsKey]);
    }

    calculateSrsScore(availableAt, values) {
      const lowestSrsStage = this.findLowestSrsStage(values);
      return availableAt + srsScores[lowestSrsStage]
    }
    createEnhancedGroup(x) {
      const values = x[1];
      const allPassed = values.every( x => x[passedKey] );
      const availableAt = this.timeService.getTime(x[0]);
      const availableIn = this.timeService.calcAvailableIn(availableAt);
      const srsScore = this.calculateSrsScore(availableAt, values);

      return {
        [valuesKey]: values,
        [availableInHoursKey]: this.timeService.msToHours(availableIn),
        [availableAtMsKey]: availableAt,
        [amountKey]: values.length,
        [srsScoreKey]: srsScore,
        [allPassedKey]: allPassed,
        [tagsKey]: []
      };
    };

    createEnhancedTotal(groups) {
      const lowestGroup = first(this.sortByLowestLevel(groups));
      const largestGroup = first(this.sortByLargestAmount(groups));
      const groupsSortedByEarliest = this.sortByFirstAvailable(groups);
      const earliestGroup = first(groupsSortedByEarliest);
      const latestGroup = last(groupsSortedByEarliest);

      // const groupLayout = [earliestGroup, lowestGroup, largestGroup, ...groupsSortedByEarliest];
      // const distinctGroups = [... new Set(groupLayout)];

      return {
        [latestKey]: latestGroup,
        [availableAtMsKey]: earliestGroup,
        [amountKey]: largestGroup,
        [srsScoreKey]: lowestGroup,
        [valuesKey]: groupsSortedByEarliest
      };
    }
  }

  class CuDomDynamicScaffoldingService {
    constructor(dataService, settings){
      this.dataService = dataService;
      this.settings = settings;

      this.timelineScalings = [6, 12, 24, 48, 72, 96, 192];
    }

    init($root) {
      const domainModel = this.dataService.getDomainModel();
      this.initGroups( domainModel, $root );
      this.initTimeline( domainModel, $root );
    }

    uninit($root) {
      $root.find(".cu-group-root").children().remove();
      $root.find(".cu-timeline-root").children().remove();
    }

    update($root) {
      this.uninit($root);
      this.init($root);
    }

    initGroups(domainModel, $root) {
      const groups = this.createGroups(domainModel);
      $root.find(".cu-group-root")
        .append(groups);
    }

    createGroups(domainModel) {
      const maxGroups = this.settings.getMaxGroups();
      return domainModel[valuesKey]
        .slice(0, maxGroups)
        .map((g, i) => this.createGroup(domainModel, g, i));
    }

    createGroup(domainModel, group, index) {
      const $head = this.createGroupHead(domainModel, group, index);
      const $body = this.createBody(group);

      return $("<div class='cu-group' />")
        .append($head)
        .append($body);
    };

    createBody(group) {
      const gridValues = group[valuesKey].map(v => this.createGridValue(v));

      return $("<div class='cu-grid' />")
        .append(gridValues);
    };

    createTag(name, title) {
      return $("<div class='cu-tag' />")
        .text(name)
        .attr("title", title);
    }

    createTags(domainModel, group) {
      const tags = [];
      if (group === domainModel[availableAtMsKey] ) {
        tags.push(this.createTag("earliest", "This group will be the earliest available for review."));
      }
      if (group === domainModel[amountKey]) {
        tags.push(this.createTag("largest", "This group contains the largest amount of review material."));
      }
      if (group === domainModel[srsScoreKey]) {
        tags.push(this.createTag("critical", "In this group are one or more items of the lowest SRS stage."));
      }
      return tags;
    };

    createTimeToGo(group) {
      return $("<div class='cu-group-time' />")
        .data(availableAtMsKey, group[availableAtMsKey])
    };

    createGridItemContent(value) {
      if (value.characterImage) {
        return $("<img  src=''/>")
          .attr("src", value.characterImage);
      } else {
        return $(document.createTextNode(value.characters));
      }
    }

    createGridValue(value) {
      const className = this.getClassName(value.type);
      const $itemContent = this.createGridItemContent(value);

      return $("<div class='cu-value' />")
        .addClass(className)
        .append($itemContent);
    };

    createGroupNumber(group, index) {
      const passedClass = this.getPassedClass(group);
      return $("<div class='cu-group-number badge' />")
        .addClass(passedClass)
        .text(index + 1);
    }
    createGroupHead(domainModel, group, index) {
      const tags = this.createTags(domainModel, group);
      const $number = this.createGroupNumber(group, index);
      const $spacer = $("<div class='cu-spacer' />");
      const $timeToGo = this.createTimeToGo(group);

      return $("<div class='cu-group-head' />")
        .append($number)
        .append(tags)
        .append($spacer)
        .append($timeToGo);
    }

    getClassName(type) {
      switch (type) {
        case "Kanji":
          return "kanji-icon";
        case "Radical":
          return "radical-icon";
      }
    };

    initTimeline(domainModel, $root) {
      if (!this.settings.getShowTimeline()) return;
      const timescaleHours = this.calculateScale(domainModel);
      const indicatorStyle = this.settings.getIndicatorStyle();

      const $timeAxis = $("<div class='cu-time-axis boxshadow-inset bg-mid-gray' />");
      const $scaleEnd = $("<div class='cu-scale-end' />");
      const $head = $("<div class='cu-scale-head' />")
        .text(`${timescaleHours} hours`);

      const indicators = domainModel[valuesKey].map((g, i) => this.createIndicator(g, i));
      const scales = Array(timescaleHours).fill().map((_, i) => this.createScale(timescaleHours, i));

      $root.find(".cu-timeline-root")
        .append($head)
        .append($timeAxis)
        .append(scales)
        .append($scaleEnd)
        .append(indicators)
        .attr("cu-style", indicatorStyle)
        .data(timescaleHoursKey, timescaleHours);
    };

    getPassedClass(group) {
      return group[allPassedKey] ? "cu-all-passed": "cu-not-all-passed";
    }

    createIndicator(group, index) {
      const passedClass = this.getPassedClass(group);
      const maxGroups = this.settings.getMaxGroups();
      const isInactive = index >= maxGroups;
      return $("<div class='cu-indicator' />")
        .addClass(passedClass)
        .attr("cu-inactive", isInactive)
        .text(index + 1)
        .data(availableAtMsKey, group[availableAtMsKey]);
    };

    createScale(total, index) {
      const left = index / total * 100;
      return $("<div class='cu-scale' />").css({'left': `calc(${left}% - 1px)`}); // -1 to center
    }

    calculateScale(domainModel) {
      // smallest fitting scale
      const availableInHours = domainModel[valuesKey].map(v => v[availableInHoursKey]);
      return availableInHours.reduce((prev, cur) => this.timelineScalings.find(x => x > cur) || prev, 0);
    }
  }

  class CuDomScaffoldingService {
    constructor(settings) {
      this.settings = settings;
    }

    buildComponent() {
      const $head = this.createHeading();
      const $settings = this.createSettings();
      const $timelineRoot = this.createTimelineRoot();
      const $groupRoot = this.createGroupRoot();

      return $("<div class='cu-root' />")
        .append($head)
        .append($settings)
        .append($timelineRoot)
        .append($groupRoot);
    }
    createHeading() {
      return $("<h2 class='text-xl text-medium text-dark-gray text-left mb-0' />")
        .append("<span>Upcoming</span>")
        .append("<span class='cu-btn-settings text-gray'><i class='icon-cog' /></span>")
    }

    createOption(option) {
      return $("<option />")
        .attr("value", option.value)
        .text(option.text)
        .prop("selected", option.selected);
    }

    createDropdown(opt) {
      const options$ = opt.options.map(o => this.createOption(o));
      const $select = $("<select class='cu-select' />")
        .attr("id", opt.id)
        .addClass(opt.className)
        .append(options$)
      const $1 = $("<div class='' />")
        .append($select)
      const $label = $("<label class='cu-label' />")
        .text(opt.label)
        .attr("for", opt.id);
      const $description = $("<aside class='cu-aside' />")
        .text(opt.description);
      const $2 = $("<div class='' />")
        .append($label)
        .append($description);
      return [$1, $2];
    }
    createSettings() {
      const $maxGroups = this.createDropdown({options:[{text: "2", value: 2 },{text: "4", value: "4"},{text: "6", value: "6"},{text: "8", value: "8"}], id: "cu-max-groups", label: "Max No. of groups displayed" });
      const $showTimeline = this.createDropdown({options:[{text: "Yes", value: true },{text: "No", value: false}], id: "cu-show-timeline", label: "Show Timeline" });
      const $showPassedItems = this.createDropdown({options:[{text: "Yes", value: true },{text: "No", value: false}], id: "cu-show-passed-items", label: "Show Passed Items", description:"Includes items of this level that you already passed."});
      const $indicatorStyle = this.createDropdown({options:[{text: "Circle", value: "circle" },{text: "Cone", value: "cone"}], id: "cu-select-indicator-style", label: "Timeline Indicator Style"});

      const $form = $("<div class='cu-settings' />")
        .append($showTimeline)
        .append($showPassedItems)
        .append($indicatorStyle)
        .append($maxGroups)

      return $("<fieldset class='cu-settings-root hidden' />")
        .append($form);
    }

    createGroupRoot() {
      return $("<div class='cu-group-root' />");
    }

    createTimelineRoot(domainModel) {
      return $("<div class='cu-timeline-root relative' />");
    }
  }

  class CuTimeService {
    constructor() {
      this.refresh();
    }
    refresh() {
      this.now = new Date().getTime();
    }
    getTime(dateTime) {
      return new Date(dateTime).getTime();
    }
    calcAvailableIn(availableAt) {
      return availableAt - this.now;
    }
    msToHours(ms) {
      return ms / 1000 / 60 / 60;
    }
    hoursToMs(h) {
      return h * 1000 * 60 * 60;
    }
  }
  class CuMountService {
    constructor($root) {
      this.$root = $root;
    }
    mount($mountPoint) {
      this.$root.insertAfter($mountPoint);
    }

    unmount() {
      this.$root.remove();
    }
  }
  class CuController {
    constructor(timeService, settings) {
      this.timeService = timeService;
      this.settings = settings;

      this.intervalUpdate = this.intervalUpdate.bind(this);
      this.resizeUpdate = this.resizeUpdate.bind(this);
    }

    update($root) {
      this.uninit();
      this.init($root);
    }
    init($root) {
      this.setUpRefs($root);

      this.uninit();
      this.initInternal();
      this.intervalId = setInterval(this.intervalUpdate, 1000 * 60); // 60s
      window.removeEventListener("resize", this.resizeUpdate);
    }

    uninit() {
      clearTimeout(this.timeoutId);
      clearInterval(this.intervalId);
      window.addEventListener("resize", this.resizeUpdate);
    }

    initInternal() {
      this.intervalUpdate();
      this.setOverflowIndicator();
    }

    resizeUpdate() {
      this.removeOverflowIndicator();
      this.setOverflowIndicator();
    }

    intervalUpdate() {
      this.timeService.refresh();
      this.updateGroupTimes();
      this.updateTimelineIndicator();
      this.resizeUpdate(); // updating group times might have resized the grid ...
    }

    removeOverflowIndicator() {
      this.$groups.find(".cu-overflow-icon").remove();
    }

    createTimeLiteral(dcMinutesToGo) {
      if (dcMinutesToGo <= 0) {
        return 'available';
      }
      const minutesToGo = Math.ceil(dcMinutesToGo);
      if (minutesToGo <= 60) {
        const suffix = minutesToGo === 1 ? 'minute' : 'minutes';
        return `in ${minutesToGo} ${suffix}`;
      }
      const hoursToGo = Math.ceil(minutesToGo / 60);
      if (hoursToGo <= 48) {
        return `in ${hoursToGo} hours`;
      }
      const daysToGo = Math.ceil(hoursToGo / 24);
      return `in ${daysToGo} days`;
    }

    updateGroupTimes() {
      this.$groupTimes.each((i, e) => {
        const $groupTime = $(e);
        const availableAt = $groupTime.data(availableAtMsKey);
        const dcMinutesToGo = this.timeService.calcAvailableIn(availableAt) / 1000 / 60;
        const text = this.createTimeLiteral(dcMinutesToGo);
        $groupTime.text(text);
      });
    }

    getIndicatorCss(relative, halfIndicatorWidth) {
      if (relative < 0) {
        return {
          'left': `-${halfIndicatorWidth}px`
        };
      }
      if (relative > 100) {
        return {
          'visibility': 'hidden'
        }
      }
      return {
        'left': `calc(${relative}% - ${halfIndicatorWidth}px)`
      }
    }

    updateTimelineIndicator() {
      const timescaleMs = this.timeService.hoursToMs(this.$timeline.data(timescaleHoursKey));
      this.$timelineIndicators.each((i, e) => {
        const $indicator = $(e);
        const availableAt = $indicator.data(availableAtMsKey);
        const relative = this.timeService.calcAvailableIn(availableAt) / timescaleMs * 100;
        const halfIndicatorWidth = $indicator.outerWidth() / 2;
        $indicator.css(this.getIndicatorCss(relative, halfIndicatorWidth));
      });
    }

    setOverflowIndicator() {
      this.$groups.each((i, e) => {
        const $group = $(e);
        const $grid = $group.find(".cu-grid");
        const $values = $group.find(".cu-value");
        const bounds = {x: $grid.width(), y: $grid.height()};

        const $visibles = $values.filter((i, v) => {
          const position = $(v).position();
          return position.left < bounds.x && position.top < bounds.y;
        });
        if ($visibles.length === $values.length) return;

        const lastVisible = $visibles.last();
        const numInvisible = $values.length - $visibles.length + 1; // +1 because the last visible element now gets obscured.

        const $overflowIndicator = $("<div class='cu-overflow-icon' />")
          .text(`+${numInvisible}`);

        $(lastVisible).append($overflowIndicator);
      });
    };

    setUpRefs($root) {
      this.$timeline = $root.find(".cu-timeline-root");
      this.$timelineIndicators = this.$timeline.find(".cu-indicator");
      this.$groups = $root.find(".cu-group");
      this.$groupTimes = this.$groups.find(".cu-group-time");
    }
  }


  class CuSettingsController {
    constructor(bootstrap, settings) {
      this.bootstrap = bootstrap;
      this.settings = settings;

      // caveman mode
      this.toggleSettings = this.toggleSettings.bind(this);
      this.updateTimeline = this.updateTimeline.bind(this);
      this.updatePassed = this.updatePassed.bind(this);
      this.updateIndicatorStyle = this.updateIndicatorStyle.bind(this);
      this.updateMaxGroups = this.updateMaxGroups.bind(this);
    }

    init($root) {
      this.setUpRefs($root);
      this.$btnSettings.on("click", this.toggleSettings);
      this.$showTimeline.on("change", this.updateTimeline);
      this.$showPassedItems.on("change", this.updatePassed);
      this.$indicatorStyle.on("change", this.updateIndicatorStyle);
      this.$maxGroups.on("change", this.updateMaxGroups);
    }

    uninit($root) {
      this.setUpRefs($root);
      this.$btnSettings.off("click", this.toggleSettings);
      this.$showTimeline.off("change", this.updateTimeline);
      this.$showPassedItems.off("change", this.updatePassed);
      this.$indicatorStyle.off("change", this.updateIndicatorStyle);
      this.$maxGroups.off("change", this.updateMaxGroups);
    }

    toggleSettings() {
      this.$settings.toggleClass("hidden");
    }
    updateIndicatorStyle(e) {
      const value = e.target.value;
      this.settings.setIndicatorStyle(value);
      this.bootstrap.update(this.$root);
    }
    updateMaxGroups(e) {
      const value = Number(e.target.value);
      this.settings.setMaxGroups(value);
      this.bootstrap.update(this.$root);
    }
    updateTimeline(e) {
      const value = JSON.parse(e.target.value);
      this.settings.setShowTimeline(value);
      this.bootstrap.update(this.$root);
    }
    updatePassed(e) {
      const value = JSON.parse(e.target.value);
      this.settings.setShowPassed(value);
      this.bootstrap.update(this.$root);
    }

    setUpRefs($root) {
      this.$root = $root;
      this.$settings = $root.find(".cu-settings-root");
      this.$btnSettings = $root.find(".cu-btn-settings");
      this.$showTimeline = this.$settings.find("#cu-show-timeline");
      this.$showPassedItems = this.$settings.find("#cu-show-passed-items");
      this.$indicatorStyle = this.$settings.find("#cu-select-indicator-style");
      this.$maxGroups = this.$settings.find("#cu-max-groups");
    }
  }

  class CuSettings {
    constructor() {
      this.storagePrefix = "cu-";
      this.maxGroupsKey = "maxGroups";
      this.showTimelineKey = "showTimeline";
      this.showPassedKey = "showPassed";
      this.indicatorStyleKey = "indicatorStyle";
    }

    getShowTimeline() {
      return JSON.parse(this._loadSetting(this.showTimelineKey, "true"));
    }

    getShowPassed() {
      return JSON.parse(this._loadSetting(this.showPassedKey, "true"));
    }

    getMaxGroups() {
      return Number(this._loadSetting(this.maxGroupsKey, 4));
    }

    getIndicatorStyle() {
      return this._loadSetting(this.indicatorStyleKey, "circle");
    }

    setShowTimeline(flag) {
      this._saveSetting(this.showTimelineKey, flag);
    }

    setShowPassed(flag) {
      this._saveSetting(this.showPassedKey, flag);
    }

    setMaxGroups(num) {
      this._saveSetting(this.maxGroupsKey, num);
    }

    setIndicatorStyle(name) {
      this._saveSetting(this.indicatorStyleKey, name);
    }

    _saveSetting(key, value) {
      const fqKey = this._getFullKey(key);
      localStorage.setItem(fqKey, value);
    }

    _loadSetting(key, def) {
      const fqKey = this._getFullKey(key);
      const result = localStorage.getItem(fqKey);
      return result === null ? def : result;
    }

    _getFullKey (key) {
      return `${this.storagePrefix}${key}`;
    }
  }

  class CuBootstrapper {
    constructor() {
      this.selector = ".progression";
      this.settings = new CuSettings();
      this.timeService = new CuTimeService();
      this.dataProvider = new CuDataProvider(this.selector);
      this.dataService = new CuDataService(this.timeService, this.dataProvider, this.settings);
      this.scaffoldingService = new CuDomScaffoldingService(this.settings);
      this.dynamicsService = new CuDomDynamicScaffoldingService(this.dataService, this.settings);
      this.controller = new CuController(this.timeService, this.settings);
      this.settingsController = new CuSettingsController(this, this.settings);
    }

    start() {
      const $progression = $(this.selector);
      if (!$progression.length) return;

      const $mountPoint = $progression.find("div[title]").first();

      const $root = this.scaffoldingService.buildComponent();
      const mountService = new CuMountService($root);
      mountService.mount($mountPoint);

      this.settingsController.init($root);
      this.dynamicsService.init($root);
      this.controller.init($root);
      return $root;
    }

    update($root) {
      this.dynamicsService.update($root);
      this.controller.update($root);
    }
  }

  new CuBootstrapper().start();
  // set up
})(window.$);
