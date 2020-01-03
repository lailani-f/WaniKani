// ==UserScript==
// @name         WaniKani Coming Up
// @namespace    wk_lai
// @version      1.0
// @description  Shows upcoming progression reviews concisely
// @require      http://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
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

  const indicatorWidth = 16;
  const halfIndicatorWidth = indicatorWidth / 2;

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
    '.cu-settings { }' +
    '.cu-group-head { position: relative; display: flex; padding-top: 2px;background: linear-gradient(180deg,  #999 calc(0px), #fff calc(1px), transparent calc(100%)); margin-bottom: 5px; }' +
    '.cu-group-number { padding: 2px; width: 18px; text-align: center; background-color: #7000a9; }' +
    '.cu-group-head .cu-group-number { border-radius: 0; }' +
    '.cu-group-time { font-size: 11.844px; color: rgba(0,0,0,0.6); padding: 2px 3px 0; line-height: 14px; }' +
    `.cu-timeline { height: 16px; margin: 0 ${halfIndicatorWidth}px 13px; }` +
    `.cu-time-axis { position: absolute; left: 0; right: 0; top: 0; height: 3px; border-top: 1px solid white; border-bottom: 1px solid white; margin: 0 -${halfIndicatorWidth}px; }` +
    `.cu-indicator { position: absolute; transition: left .5s ease-out; }` +
    `.cu-indicator-circle { top: 2px; width: ${indicatorWidth}px; padding: 1px 0; font-size: 11.844px; line-height: 14px; border-radius: 8px; background-color: #7000a9; }` +
    `.cu-indicator-cone { top: 3px; padding: 0; width: 0px;  height: 0px; color: transparent; border-left: ${halfIndicatorWidth}px solid transparent; border-right: ${halfIndicatorWidth}px solid transparent; border-bottom: ${indicatorWidth}px solid rgb(112, 0, 169); }` +
    '.cu-tag { background-color: #fff; color: rgba(0,0,0,0.6); text-shadow: none; font-weight: normal; }' +
    '.cu-spacer { flex-grow: 1; }' +
    '.cu-scale { position: absolute; top: 2px; height: 6px; border-left: 1px solid #d8d8d8; border-right: 1px solid white; }' +
    '.cu-scale-end { position: absolute; left: 100%; top: 2px; height: 6px; width: 8px; background: linear-gradient(135deg, #d8d8d8 50%, transparent calc(50% + 1px)); }' +
    '.cu-scale-head { position: absolute; right: 0; bottom: 100%; font-size: 11.844px; line-height: 1em; color: #777; font-weight: 300; text-shadow: 0 1px 0 #fff;}' +
    '.cu-overflow-icon { position: absolute; top:0; left: 0; padding: 0; font-size: 14px; height: 100%; width: 100%; line-height: 2em; background: linear-gradient(-45deg, #5571e2, #294ddb); }'
  );

  class CuDataProvider {
    constructor(selector) {
      this.selector = selector;
    }
    getData() {
      return $(this.selector).children("div").data("react-props").data;
    }
  }

  class CuDataService {
    constructor(timeService, dataProvider) {
      this.timeService = timeService;
      this.dataProvider = dataProvider;
    }
    getDomainModel() {
      const rawData = this.dataProvider.getData();
      const unlockedData = rawData.filter(v => v[unlockedAtKey] && !v[passedAtKey]);
      const groupedData = Array.from(groupBy(unlockedData, availableAtKey));
      const filteredData = groupedData.filter(x => x[0] != null).filter(x => x[1].length);
      const enhancedGroups = filteredData.map(d => this.createEnhancedGroup(d));
      return this.createEnhancedTotal(enhancedGroups);
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
      const availableAt = this.timeService.getTime(x[0]);
      const availableIn = this.timeService.calcAvailableIn(availableAt);
      const srsScore = this.calculateSrsScore(availableAt, values);
      return {
        [valuesKey]: values,
        [availableInHoursKey]: this.timeService.msToHours(availableIn),
        [availableAtMsKey]: availableAt,
        [amountKey]: values.length,
        [srsScoreKey]: srsScore,
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

  class CuDomScaffoldingService {
    constructor(dataService, settings) {
      this.dataService = dataService;
      this.settings = settings;
      this.timelineScalings = [6, 12, 24, 48, 72, 96];
    }

    buildComponent(maxGroups) {
      const domainModel = this.dataService.getDomainModel();

      const $head = this.createHeading();
      const $timeline = this.createTimeline(domainModel);
      const $groupContainer = this.createGroupContainer(domainModel, maxGroups);
      const $settings = this.createSettings();

      return $("<div class='cu-root' />")
        .append($head)
        .append($settings)
        .append($timeline)
        .append($groupContainer);
    }
    createHeading() {
      return $("<h2 class='text-xl text-medium text-dark-gray text-left mb-0' />")
        .append("<span>Upcoming</span>")
        .append("<span class='cu-btn-settings text-gray'><i class='icon-cog' /></span>")
    }
    createSettings() {
      const $showTimelineBtn = $("<input type='checkbox' id='cu-show-timeline' />")
        .prop("checked", this.settings.getShowTimeline());
      const $showTimelineLabel = $("<label class='checkbox'>Show Timescale</label>")
        .append($showTimelineBtn);

      const $showPassedItemsBtn = $("<input type='checkbox' id='cu-show-passed-items' />")
        .prop("checked", this.settings.getShowPassed());
      const $showPassedItemsLabel = $("<label title='Show items of this level that you already passed.' class='checkbox'>Show Passed</label>")
        .append($showPassedItemsBtn);

      const $showTimeline = $("<fieldset />")
        .append($showTimelineLabel)
        .append($showPassedItemsLabel);

      return $("<div class='cu-settings hidden' />")
        .append($showTimeline);
    }

    createGroupContainer(domainModel, maxGroups) {
      const groups = this.createGroups(domainModel, maxGroups);

      return $("<div class='cu-group-root' />")
        .append(groups);
    }

    createGroups(domainModel, maxGroups) {
      return domainModel[valuesKey]
        .slice(0, maxGroups || 3)
        .map((g, i) => this.createGroup(domainModel, g, i));
    }

    getClassName(type) {
      switch (type) {
        case "Kanji":
          return "kanji-icon";
        case "Radical":
          return "radical-icon";
      }
    };

    createTag(name, title) {
      return $("<div class='cu-tag badge' />")
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

    createBody(group) {
      const gridValues = group[valuesKey].map(v => this.createGridValue(v));

      return $("<div class='cu-grid' />")
        .append(gridValues);
    };

    createGroupHead(domainModel, group, index) {
      const tags = this.createTags(domainModel, group);
      const $number = $("<div class='cu-group-number badge' />")
        .text(index + 1);
      const $spacer = $("<div class='cu-spacer' />");
      const $timeToGo = this.createTimeToGo(group);

      return $("<div class='cu-group-head' />")
        .append($number)
        .append(tags)
        .append($spacer)
        .append($timeToGo);
    }

    createGroup(domainModel, group, index) {
      const $head = this.createGroupHead(domainModel, group, index);
      const $body = this.createBody(group);

      return $("<div class='cu-group' />")
        .append($head)
        .append($body);
    };

    createIndicator(group, index) {
      return $("<div class='cu-indicator cu-group-number badge' />")
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
    createTimeline(domainModel) {
      const timescaleHours = this.calculateScale(domainModel);

      const $timeAxis = $("<div class='cu-time-axis boxshadow-inset bg-mid-gray' />");
      const $scaleEnd = $("<div class='cu-scale-end' />");
      const $head = $("<div class='cu-scale-head' />")
        .text(`${timescaleHours} hours`);

      const indicators = domainModel[valuesKey].map(this.createIndicator);
      const scales = Array(timescaleHours).fill().map((_, i) => this.createScale(timescaleHours, i));

      return $("<div class='cu-timeline relative' />")
        .append($head)
        .append($timeAxis)
        .append(scales)
        .append($scaleEnd)
        .append(indicators)
        .data(timescaleHoursKey, timescaleHours);
    };
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

  class CuController {
    constructor(scaffoldingService, timeService, settings) {
      this.scaffoldingService = scaffoldingService;
      this.timeService = timeService;
      this.settings = settings;

      // caveman mode
      this.initInternal = this.initInternal.bind(this);
      this.intervalUpdate = this.intervalUpdate.bind(this);
      this.resizeUpdate = this.resizeUpdate.bind(this);
      this.toggleSettings = this.toggleSettings.bind(this);
      this.toggleTimeline = this.toggleTimeline.bind(this);
      this.togglePassed = this.togglePassed.bind(this);
    }

    init($mountPoint) {
      this.setUpRefs();
      this.mount($mountPoint);

      this.uninit();
      this.timeoutId = setTimeout(this.initInternal, 10); // 10ms
      this.intervalId = setInterval(this.intervalUpdate, 1000 * 60); // 60s
      window.addEventListener("resize", this.resizeUpdate);
      this.$btnSettings.on("click", this.toggleSettings);
      this.$btnShowTimeline.on("change", this.toggleTimeline);
      this.$btnShowPassed.on("change", this.togglePassed);
    }

    toggleSettings() {
      this.$settings.toggleClass("hidden");
    }
    toggleTimeline() {
      this.settings.setShowTimeline(!this.settings.getShowTimeline());
      this.updateTimelineVisibility();
    }
    togglePassed() {
      this.settings.setShowPassed(!this.settings.getShowPassed());
      this.updateTimelineVisibility();
    }

    updateTimelineVisibility() {
      const visible = this.settings.getShowTimeline();
      if (visible) {
        this.$timeline.removeClass("hidden");
      } else {
        this.$timeline.addClass("hidden");
      }
    }

    uninit() {
      clearTimeout(this.timeoutId);
      clearInterval(this.intervalId);
      window.removeEventListener("resize", this.resizeUpdate);
      this.$btnSettings.off("click", this.toggleSettings);
      this.$btnShowTimeline.off("click", this.toggleTimeline);
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
      if (dcMinutesToGo <= 60) {
        const minutesToGo = Math.ceil(dcMinutesToGo);
        const suffix = minutesToGo === 1 ? 'minute' : 'minutes';
        return `in ${minutesToGo} ${suffix}`;
      }
      const hoursToGo = Math.ceil(dcMinutesToGo / 60);
      return `in ${hoursToGo} hours`;
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

    getIndicatorCss(relative) {
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
        $indicator.css(this.getIndicatorCss(relative));
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

    setUpRefs() {
      this.$root = this.scaffoldingService.buildComponent(this.settings.getMaxGroups());
      this.$timeline = this.$root.find(".cu-timeline");
      this.$timelineIndicators = this.$timeline.find(".cu-indicator");
      this.$groups = this.$root.find(".cu-group");
      this.$groupTimes = this.$groups.find(".cu-group-time");
      this.$btnSettings = this.$root.find(".cu-btn-settings");
      this.$settings = this.$root.find(".cu-settings");
      this.$btnShowTimeline = this.$settings.find("#cu-show-timeline");
      this.$btnShowPassed = this.$settings.find("#cu-show-passed-items");
    }

    mount($mountPoint) {
      this.$root.insertAfter($mountPoint);
    }

    unmount() {
      this.$root.remove();
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
      this.dataService = new CuDataService(this.timeService, this.dataProvider);
      this.scaffoldingService = new CuDomScaffoldingService(this.dataService, this.settings);
      this.controller = new CuController(this.scaffoldingService, this.timeService, this.settings);
    }

    start() {
      const $progression = $(this.selector);
      if (!$progression.length) return false;

      const $mountPoint = $progression.find("div[title]").first();
      this.controller.init($mountPoint);
      return true;
    }
  }

  new CuBootstrapper().start();
  // set up
})(window.$);